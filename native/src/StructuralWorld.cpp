#include "framelabs/StructuralWorld.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <thread>

namespace framelabs {
namespace {
constexpr float Pi = 3.14159265358979323846f;
constexpr float Gravity = 9.81f;
constexpr float GroundY = 0.0f;
constexpr int SolverIterations = 12;
constexpr float MaxPhysicsSubstep = 1.0f / 240.0f;
constexpr int MemberSubdivisions = 5;

float clampf(float v, float lo, float hi) { return std::max(lo, std::min(v, hi)); }
float length(Vec2 v) { return std::sqrt(v.x * v.x + v.y * v.y); }
Vec2 add(Vec2 a, Vec2 b) { return {a.x + b.x, a.y + b.y}; }
Vec2 sub(Vec2 a, Vec2 b) { return {a.x - b.x, a.y - b.y}; }
Vec2 mul(Vec2 a, float s) { return {a.x * s, a.y * s}; }
float dot(Vec2 a, Vec2 b) { return a.x * b.x + a.y * b.y; }
float distance(Vec2 a, Vec2 b) { return length(sub(a,b)); }
float distanceToSegment(Vec2 point, Vec2 a, Vec2 b) {
    const Vec2 ab = sub(b, a);
    const float denominator = dot(ab, ab);
    const float t = denominator > 1e-8f ? clampf(dot(sub(point, a), ab) / denominator, 0.0f, 1.0f) : 0.0f;
    return distance(point, add(a, mul(ab, t)));
}
float angleOf(Vec2 v) { return std::atan2(v.y, v.x); }
float wrapAngle(float a) { while(a > Pi) a -= 2*Pi; while(a < -Pi) a += 2*Pi; return a; }

struct Particle {
    Vec2 p{}, previous{};
    bool pinned = false;
    float mass = 0.5f;
    float inverseMass = 2.0f;
    float radius = 0.075f;
};
struct Constraint {
    std::size_t a=0,b=0;
    float rest=0;
    float stiffness=1;
};
struct MemberData {
    MemberId id=0;
    NodeId a=0,b=0;
    MaterialKind material=MaterialKind::Steel;
    MemberRole role=MemberRole::Beam;
    std::vector<std::size_t> particles;
    std::vector<Constraint> axial;
    float restLength=0;
    float restAngle=0;
    float temperature=20;
    float damage=0;
    float fatigue=0;
    float stress=0;
    float bend=0;
    bool broken=false;
};
struct NodeData { NodeId id=0; std::size_t particle=0; };
struct LoadData { LoadView view{}; Vec2 velocity{}; };

void applyParticleImpulse(Particle& particle, Vec2 impulse, float dt) {
    if (particle.inverseMass <= 0.0f || dt <= 1e-6f) return;
    Vec2 velocity = mul(sub(particle.p, particle.previous), 1.0f / dt);
    velocity = add(velocity, mul(impulse, particle.inverseMass));
    particle.previous = sub(particle.p, mul(velocity, dt));
}

void applyLoadImpulse(LoadData& load, Vec2 impulse, float inverseMass, float dt) {
    if (inverseMass <= 0.0f || dt <= 1e-6f) return;
    Vec2 velocity = mul(sub(load.view.position, load.velocity), 1.0f / dt);
    velocity = add(velocity, mul(impulse, inverseMass));
    load.velocity = sub(load.view.position, mul(velocity, dt));
}

// Continuous capsule-versus-segment contact, with optional material-based
// restitution and friction on the final solver pass.
void resolveLoadSegmentContact(LoadData& load, Particle& a, Particle& b,
                               float loadInverseMass, float dt,
                               const MaterialProfile& profile, bool solveVelocity) {
    const Vec2 ab = sub(b.p, a.p);
    const float denominator = dot(ab, ab);
    const float t = denominator > 1e-8f
        ? clampf(dot(sub(load.view.position, a.p), ab) / denominator, 0.0f, 1.0f)
        : 0.0f;
    const Vec2 closest = add(a.p, mul(ab, t));
    const Vec2 delta = sub(closest, load.view.position);
    const float d = length(delta);
    const float memberRadius = std::max(0.07f, std::max(a.radius, b.radius));
    const float minimumDistance = load.view.radius + memberRadius;
    if (d >= minimumDistance) return;

    const Vec2 normal = d > 1e-5f ? mul(delta, 1.0f / d) : Vec2{0.0f, 1.0f};
    const float oneMinusT = 1.0f - t;
    const float invA = a.inverseMass * oneMinusT * oneMinusT;
    const float invB = b.inverseMass * t * t;
    const float totalInverseMass = loadInverseMass + invA + invB;
    if (totalInverseMass <= 1e-8f) return;

    const float penetration = minimumDistance - d;
    a.p = add(a.p, mul(normal, penetration * a.inverseMass * oneMinusT / totalInverseMass));
    b.p = add(b.p, mul(normal, penetration * b.inverseMass * t / totalInverseMass));
    load.view.position = sub(load.view.position, mul(normal, penetration * loadInverseMass / totalInverseMass));

    if (!solveVelocity || dt <= 1e-6f) return;
    const auto particleVelocity = [dt](const Particle& p) {
        return mul(sub(p.p, p.previous), 1.0f / dt);
    };
    const auto loadVelocity = [&load, dt]() {
        return mul(sub(load.view.position, load.velocity), 1.0f / dt);
    };
    Vec2 va = particleVelocity(a), vb = particleVelocity(b), vl = loadVelocity();
    Vec2 vm = add(mul(va, oneMinusT), mul(vb, t));
    Vec2 relative = sub(vl, vm);
    const float closingSpeed = dot(relative, normal);
    float normalImpulse = 0.0f;
    if (closingSpeed > 0.0f) {
        normalImpulse = (1.0f + clampf(profile.restitution, 0.0f, 0.35f)) *
                        closingSpeed / totalInverseMass;
        applyLoadImpulse(load, mul(normal, -normalImpulse), loadInverseMass, dt);
        applyParticleImpulse(a, mul(normal, normalImpulse * oneMinusT), dt);
        applyParticleImpulse(b, mul(normal, normalImpulse * t), dt);
    }

    va = particleVelocity(a); vb = particleVelocity(b); vl = loadVelocity();
    vm = add(mul(va, oneMinusT), mul(vb, t));
    relative = sub(vl, vm);
    const Vec2 tangent{-normal.y, normal.x};
    const float tangentSpeed = dot(relative, tangent);
    if (std::fabs(tangentSpeed) <= 1e-5f) return;
    const float friction = std::fabs(tangentSpeed) < 0.12f
        ? profile.staticFriction : profile.dynamicFriction;
    const float limit = normalImpulse * clampf(friction, 0.0f, 1.2f);
    const float tangentImpulse = clampf(-tangentSpeed / totalInverseMass, -limit, limit);
    applyLoadImpulse(load, mul(tangent, tangentImpulse), loadInverseMass, dt);
    applyParticleImpulse(a, mul(tangent, -tangentImpulse * oneMinusT), dt);
    applyParticleImpulse(b, mul(tangent, -tangentImpulse * t), dt);
}

void resolveGroundContact(Vec2& position, Vec2& previous, float radius,
                          float dt, const MaterialProfile& profile) {
    if (position.y >= radius || dt <= 1e-6f) return;
    position.y = radius;
    float vx = (position.x - previous.x) / dt;
    float vy = (position.y - previous.y) / dt;
    const float stoppingSpeed = profile.staticFriction * Gravity * dt;
    if (std::fabs(vx) <= stoppingSpeed) vx = 0.0f;
    else vx -= std::copysign(profile.dynamicFriction * Gravity * dt, vx);
    vy = vy < 0.0f ? -vy * clampf(profile.restitution, 0.0f, 0.35f) : 0.0f;
    previous.x = position.x - vx * dt;
    previous.y = position.y - vy * dt;
}
}

const MaterialProfile& materialProfile(MaterialKind kind) noexcept {
    // Relative game tuning: steel tolerates the most elastic bending, wood a
    // little, and composite is deliberately stiff/brittle. Heat reduces both
    // bending stiffness and failure thresholds.
    static const MaterialProfile profiles[] = {
        {"steel","Steel",{120,202,255},7.8f,15.0f,9.0f,25.0f,18.0f,0.20f,0.75f,0.22f,0.72f,0.78f,4.0f,0.50f,0.30f,0.16f,0.78f,0.78f},
        {"wood","Wood",{220,167,106},0.68f,23.0f,13.0f,7.0f,5.0f,0.055f,0.105f,0.055f,0.82f,0.92f,2.5f,0.76f,0.49f,0.12f,0.62f,0.58f},
        {"composite","Composite",{178,151,230},1.25f,31.0f,18.0f,11.0f,8.0f,0.022f,0.060f,0.028f,0.90f,0.86f,3.2f,0.62f,0.38f,0.10f,0.45f,0.32f},
        {"concrete","Concrete",{180,190,205},2.35f,27.0f,15.0f,14.0f,10.0f,0.012f,0.035f,0.018f,0.88f,0.90f,2.0f,0.88f,0.64f,0.08f,0.28f,0.25f}
    };
    return profiles[static_cast<unsigned>(kind) < 4 ? static_cast<unsigned>(kind) : 0];
}

struct StructuralWorld::Impl {
    std::vector<Particle> particles;
    std::vector<NodeData> nodes;
    std::vector<MemberData> memberData;
    std::vector<NodeView> nodeViews;
    std::vector<MemberView> memberViews;
    std::vector<LoadData> loadData;
    std::vector<LoadView> loadViews;
    NodeId nextNode=1;
    MemberId nextMember=1;
    std::uint32_t nextLoad=1;
    float time=0, wind=0;
    int workers=1;

    Impl() {
        const unsigned hc=std::thread::hardware_concurrency();
        workers=static_cast<int>(std::max(1u,hc));
    }
    Particle* particleFor(NodeId id) {
        for(auto& n:nodes) if(n.id==id) return &particles[n.particle];
        return nullptr;
    }
    const Particle* particleFor(NodeId id) const {
        for(const auto& n:nodes) if(n.id==id) return &particles[n.particle];
        return nullptr;
    }
    MemberData* memberFor(MemberId id) {
        for(auto& m:memberData) if(m.id==id) return &m;
        return nullptr;
    }
    void rebuildViews() {
        nodeViews.clear();
        for(const auto& n:nodes) {
            const auto& p=particles[n.particle];
            nodeViews.push_back({n.id,p.p,p.pinned});
        }
        memberViews.clear();
        for(const auto& m:memberData) {
            // Keep fractured members visible as separated debris segments.
            const auto* a=particleFor(m.a); const auto* b=particleFor(m.b);
            if(!a||!b) continue;
            MemberView v;
            v.id=m.id; v.nodeA=m.a; v.nodeB=m.b; v.material=m.material; v.role=m.role;
            v.start=a->p; v.end=b->p; v.restLength=m.restLength;
            // Measure axial extension along the member's centerline. The
            // endpoint chord shortens during bending and must not be mistaken
            // for compressive material strain.
            v.currentLength=0.0f;
            for(std::size_t i=1;i<m.particles.size();++i){
                v.currentLength+=distance(particles[m.particles[i-1]].p,particles[m.particles[i]].p);
            }
            v.axialStrain=(v.currentLength-m.restLength)/std::max(.001f,m.restLength);
            v.stressRatio=m.stress; v.damage=m.damage; v.temperatureC=m.temperature;
            v.maxBendRadians=m.bend; v.yielding=m.stress>.72f; v.broken=m.broken;
            const auto& profile=materialProfile(m.material);
            const float thickness=(m.role==MemberRole::Slab?.22f:.14f);
            for(std::size_t i=1;i<m.particles.size();++i) {
                Vec2 p0=particles[m.particles[i-1]].p, p1=particles[m.particles[i]].p;
                Vec2 d=sub(p1,p0);
                v.segments.push_back({mul(add(p0,p1),.5f),angleOf(d),length(d),thickness});
            }
            (void)profile;
            memberViews.push_back(std::move(v));
        }
        loadViews.clear();
        for(const auto& l:loadData) loadViews.push_back(l.view);
    }
};

StructuralWorld::StructuralWorld():impl_(std::make_unique<Impl>()) { resetDemo(); }
StructuralWorld::~StructuralWorld()=default;

void StructuralWorld::clear() {
    impl_->particles.clear(); impl_->nodes.clear(); impl_->memberData.clear(); impl_->loadData.clear();
    impl_->nodeViews.clear(); impl_->memberViews.clear(); impl_->loadViews.clear();
    impl_->nextNode=1; impl_->nextMember=1; impl_->nextLoad=1; impl_->time=0; impl_->wind=0;
}
NodeId StructuralWorld::addNode(Vec2 p,bool pinned) {
    const NodeId id=impl_->nextNode++;
    Particle particle; particle.p=p; particle.previous=p; particle.pinned=pinned;
    particle.mass=0.5f;
    particle.inverseMass=pinned?0.0f:1.0f/particle.mass;
    impl_->nodes.push_back({id,impl_->particles.size()});
    impl_->particles.push_back(particle);
    impl_->rebuildViews(); return id;
}
NodeId StructuralWorld::findNodeNear(Vec2 p,float radius) const {
    NodeId best=0; float bestD=radius;
    for(const auto& n:impl_->nodes) { float d=distance(impl_->particles[n.particle].p,p); if(d<=bestD){bestD=d;best=n.id;} }
    return best;
}
bool StructuralWorld::toggleNodePin(NodeId id) {
    for(auto& n:impl_->nodes) if(n.id==id) {
        auto& p=impl_->particles[n.particle]; p.pinned=!p.pinned; p.inverseMass=p.pinned?0.0f:1.0f/std::max(0.05f,p.mass); p.previous=p.p;
        impl_->rebuildViews(); return true;
    } return false;
}
bool StructuralWorld::getNodePosition(NodeId id,Vec2& out) const {
    const auto* p=impl_->particleFor(id); if(!p)return false; out=p->p; return true;
}
MemberId StructuralWorld::addMember(NodeId a,NodeId b,MaterialKind material,MemberRole role) {
    if(a==b)return 0;
    auto* pa=impl_->particleFor(a); auto* pb=impl_->particleFor(b);
    if(!pa||!pb)return 0;
    for(const auto& m:impl_->memberData) if(!m.broken&&((m.a==a&&m.b==b)||(m.a==b&&m.b==a)))return m.id;
    const Vec2 startPosition=pa->p, endPosition=pb->p;
    const float span=distance(startPosition,endPosition); if(span<.15f)return 0;
    MemberData m; m.id=impl_->nextMember++;m.a=a;m.b=b;m.material=material;m.role=role;m.restLength=span;
    m.restAngle=angleOf(sub(endPosition,startPosition));
    const std::size_t ia=static_cast<std::size_t>(pa-impl_->particles.data());
    const std::size_t ib=static_cast<std::size_t>(pb-impl_->particles.data());
    m.particles.push_back(ia);
    const auto& profile=materialProfile(material);
    const float memberMass=std::max(0.1f,profile.density*0.25f*span);
    const float endpointMass=memberMass/(2.0f*MemberSubdivisions);
    // Share member mass with its endpoint nodes so connected members contribute
    // to node inertia instead of every joint behaving like a massless hinge.
    pa->mass+=endpointMass; pb->mass+=endpointMass;
    pa->inverseMass=pa->pinned?0.0f:1.0f/std::max(0.05f,pa->mass);
    pb->inverseMass=pb->pinned?0.0f:1.0f/std::max(0.05f,pb->mass);
    for(int i=1;i<MemberSubdivisions;++i) {
        const float t=static_cast<float>(i)/MemberSubdivisions;
        Particle p; p.p=add(startPosition,mul(sub(endPosition,startPosition),t));p.previous=p.p;
        p.mass=memberMass/MemberSubdivisions;
        p.inverseMass=1.0f/std::max(0.05f,p.mass);
        p.radius=.045f;
        m.particles.push_back(impl_->particles.size());impl_->particles.push_back(p);
    }
    m.particles.push_back(ib);
    for(std::size_t i=1;i<m.particles.size();++i) {
        auto x=m.particles[i-1],y=m.particles[i];
        m.axial.push_back({x,y,distance(impl_->particles[x].p,impl_->particles[y].p),.92f});
    }
    impl_->memberData.push_back(std::move(m));impl_->rebuildViews();return impl_->memberData.back().id;
}
bool StructuralWorld::removeMember(MemberId id) {
    auto* m=impl_->memberFor(id);if(!m)return false;m->broken=true;impl_->rebuildViews();return true;
}
MemberId StructuralWorld::findMemberNear(Vec2 p,float radius) const {
    MemberId best=0;float bestD=radius;
    for(const auto& m:impl_->memberData)if(!m.broken)for(std::size_t i=1;i<m.particles.size();++i){
        Vec2 a=impl_->particles[m.particles[i-1]].p,b=impl_->particles[m.particles[i]].p;
        Vec2 ab=sub(b,a);float den=dot(ab,ab);float t=den>1e-8f?clampf(dot(sub(p,a),ab)/den,0,1):0;
        float d=distance(p,add(a,mul(ab,t)));if(d<bestD){bestD=d;best=m.id;}
    }return best;
}
std::uint32_t StructuralWorld::addLoad(Vec2 p,float mass) {
    LoadData l;l.view.id=impl_->nextLoad++;l.view.position=p;l.view.massKg=clampf(mass,10,10000);l.view.radius=.27f;l.velocity=p;
    impl_->loadData.push_back(l);impl_->rebuildViews();return l.view.id;
}
std::uint32_t StructuralWorld::findLoadNear(Vec2 p,float radius) const {
    std::uint32_t id=0;float best=radius;for(const auto& l:impl_->loadData){float d=distance(l.view.position,p);if(d<best){best=d;id=l.view.id;}}return id;
}
bool StructuralWorld::removeLoad(std::uint32_t id) {
    auto it=std::remove_if(impl_->loadData.begin(),impl_->loadData.end(),[&](const auto& l){return l.view.id==id;});
    if(it==impl_->loadData.end())return false;impl_->loadData.erase(it,impl_->loadData.end());impl_->rebuildViews();return true;
}
void StructuralWorld::applyHeat(Vec2 p,float radius,float degreesPerSecond,float dt) {
    for(auto& m:impl_->memberData)if(!m.broken){
        auto* a=impl_->particleFor(m.a);auto* b=impl_->particleFor(m.b);if(!a||!b)continue;
        float nearestDistance=std::numeric_limits<float>::max();
        for(std::size_t i=1;i<m.particles.size();++i){
            const Vec2 start=impl_->particles[m.particles[i-1]].p;
            const Vec2 end=impl_->particles[m.particles[i]].p;
            nearestDistance=std::min(nearestDistance,distanceToSegment(p,start,end));
        }
        if(nearestDistance<radius){
            const float falloff=1.0f-nearestDistance/std::max(.01f,radius);
            m.temperature=clampf(m.temperature+degreesPerSecond*dt*falloff,20,1200);
        }
    }
    impl_->rebuildViews();
}
void StructuralWorld::setWind(float v) noexcept { impl_->wind=clampf(v,0,1); }

void StructuralWorld::step(float dt) {
    dt=clampf(dt,0,.0333f);if(dt<=0)return;
    auto& w=*impl_;
    const int substeps=std::max(1,static_cast<int>(std::ceil(dt/MaxPhysicsSubstep)));
    const float substepDt=dt/static_cast<float>(substeps);
    for(int substep=0;substep<substeps;++substep){
    dt=substepDt;
    const float dt2=dt*dt;
    const float damping=std::exp(-0.24f*dt);
    w.time+=dt;
    for(auto& p:w.particles)if(p.inverseMass>0){
        Vec2 velocity=sub(p.p,p.previous);p.previous=p.p;
        const float heightFactor=0.35f+clampf(p.p.y/20.0f,0.0f,1.5f);
        const float windAccel=w.wind*w.wind*5.0f*heightFactor;
        p.p.x+=velocity.x*damping+windAccel*dt2;
        p.p.y+=velocity.y*damping-Gravity*dt2;
        if(p.p.y<p.radius) resolveGroundContact(p.p,p.previous,p.radius,dt,materialProfile(MaterialKind::Concrete));
        if(p.p.x<-.5f){p.p.x=-.5f;p.previous.x=p.p.x+velocity.x*.2f;}
        if(p.p.x>40){p.p.x=40;p.previous.x=p.p.x+velocity.x*.2f;}
    }
    // Loads are independent dynamic masses and transfer their weight through
    // proximity contacts to member particles and nodes.
    for(auto& l:w.loadData){
        Vec2 vel=sub(l.view.position,l.velocity);l.velocity=l.view.position;
        l.view.position.x+=vel.x*damping;
        l.view.position.y+=vel.y*damping-Gravity*dt2;
        if(l.view.position.y<l.view.radius) resolveGroundContact(l.view.position,l.velocity,l.view.radius,dt,materialProfile(MaterialKind::Concrete));
        const float loadInverseMass=1.0f/std::max(0.1f,l.view.massKg/100.0f);
        for(auto& p:w.particles)if(p.inverseMass>0){
            Vec2 delta=sub(p.p,l.view.position);
            float d=length(delta),minD=l.view.radius+p.radius;
            if(d<minD&&d>.0001f){
                Vec2 normal=mul(delta,1.0f/d);
                const float totalInverseMass=p.inverseMass+loadInverseMass;
                const float penetration=minD-d;
                p.p=add(p.p,mul(normal,penetration*(p.inverseMass/totalInverseMass)));
                l.view.position=sub(l.view.position,mul(normal,penetration*(loadInverseMass/totalInverseMass)));
                Vec2 relativeVelocity=sub(sub(l.view.position,l.velocity),sub(p.p,p.previous));
                const float inward=dot(relativeVelocity,normal);
                if(inward<0.0f)p.p=sub(p.p,mul(normal,inward*0.35f));
            }
        }
        // Particle-only contacts leave gaps between subdivisions on long beams.
        // Resolve the load against the continuous segment geometry as well.
        for(auto& m:w.memberData)if(!m.broken){
            for(std::size_t i=1;i<m.particles.size();++i){
                resolveLoadSegmentContact(l,w.particles[m.particles[i-1]],w.particles[m.particles[i]],loadInverseMass,dt,materialProfile(m.material),false);
            }
        }
    }
    for(int iteration=0;iteration<SolverIterations;++iteration){
        for(auto& m:w.memberData)if(!m.broken){
            const auto& profile=materialProfile(m.material);
            const float heat=clampf((m.temperature-20)/700,0,1);
            const float stiffness=clampf(1.0f-profile.heatSoftening*heat,.12f,1);
            for(const auto& c:m.axial){
                auto& a=w.particles[c.a];auto& b=w.particles[c.b];
                Vec2 d=sub(b.p,a.p);float len=length(d);if(len<1e-6f)continue;
                float wa=a.inverseMass,wb=b.inverseMass,sum=wa+wb;if(sum<=0)continue;
                float error=(len-c.rest)/len*c.stiffness*stiffness;
                Vec2 correction=mul(d,error);
                a.p=add(a.p,mul(correction,wa/sum));b.p=sub(b.p,mul(correction,wb/sum));
            }
            // Second-neighbour constraints preserve each member's local curve
            // while allowing material-dependent elastic bending.
            const float bendStiffness=clampf(profile.angularBendHertz/40.0f*3.0f*(1-profile.heatSoftening*heat),.08f,.82f);
            for(std::size_t i=1;i+1<m.particles.size();++i){
                auto& a=w.particles[m.particles[i-1]];auto& b=w.particles[m.particles[i+1]];
                const float rest=2.0f*m.restLength/MemberSubdivisions;
                Vec2 d=sub(b.p,a.p);float len=length(d);if(len<1e-5f)continue;
                float wa=a.inverseMass,wb=b.inverseMass,sum=wa+wb;if(sum<=0)continue;
                Vec2 correction=mul(d,((len-rest)/len)*bendStiffness);
                a.p=add(a.p,mul(correction,wa/sum));b.p=sub(b.p,mul(correction,wb/sum));
            }
        }
    }
    // Re-apply continuous contacts after structural constraints so the load
    // cannot be pushed back through a member by the solver in the same step.
    for(auto& l:w.loadData){
        const float loadInverseMass=1.0f/std::max(0.1f,l.view.massKg/100.0f);
        for(auto& m:w.memberData)if(!m.broken){
            for(std::size_t i=1;i<m.particles.size();++i){
                resolveLoadSegmentContact(l,w.particles[m.particles[i-1]],w.particles[m.particles[i]],loadInverseMass,dt,materialProfile(m.material),true);
            }
        }
    }
    // Re-apply frictional ground contact after constraints to prevent
    // particles being projected below the floor at the end of a substep.
    for(auto& p:w.particles)if(p.inverseMass>0){
        resolveGroundContact(p.p,p.previous,p.radius,dt,materialProfile(MaterialKind::Concrete));
        if(p.p.x<-.5f)p.p.x=-.5f;if(p.p.x>40)p.p.x=40;
    }
    for(auto& m:w.memberData)if(!m.broken){
        const auto& profile=materialProfile(m.material);
        const auto* a=w.particleFor(m.a);const auto* b=w.particleFor(m.b);if(!a||!b)continue;
        float span=0.0f;
        for(std::size_t i=1;i<m.particles.size();++i){
            span+=distance(w.particles[m.particles[i-1]].p,w.particles[m.particles[i]].p);
        }
        const float strain=std::fabs(span-m.restLength)/std::max(.001f,m.restLength);
        float maxAngle=0;
        for(std::size_t i=1;i+1<m.particles.size();++i){
            Vec2 d0=sub(w.particles[m.particles[i]].p,w.particles[m.particles[i-1]].p);
            Vec2 d1=sub(w.particles[m.particles[i+1]].p,w.particles[m.particles[i]].p);
            maxAngle=std::max(maxAngle,std::fabs(wrapAngle(angleOf(d1)-angleOf(d0))));
        }
        const float heat=clampf((m.temperature-20)/800,0,.92f);
        const float heatEase=1.0f-profile.heatSoftening*heat;
        const float bendRatio=maxAngle/std::max(.001f,profile.breakBendRadians*heatEase);
        const float strainRatio=strain/std::max(.001f,profile.breakStrain*heatEase);
        m.stress=std::max(bendRatio,strainRatio);
        m.bend=maxAngle;
        if(m.stress>.72f)m.fatigue+=dt*(m.stress-.68f)*.42f;
        else m.fatigue=std::max(0.0f,m.fatigue-dt*.08f);
        m.damage=clampf(m.damage+std::max(0.0f,m.stress-.85f)*dt*.16f,0,.99f);
        if(m.stress>1.0f||m.fatigue>profile.fatigueSeconds){
            m.broken=true;
        }
        m.temperature=std::max(20.0f,m.temperature-dt*1.3f);
    }
    w.rebuildViews();
    }
}
const std::vector<NodeView>& StructuralWorld::nodes()const noexcept{return impl_->nodeViews;}
const std::vector<MemberView>& StructuralWorld::members()const noexcept{return impl_->memberViews;}
const std::vector<LoadView>& StructuralWorld::loads()const noexcept{return impl_->loadViews;}
std::size_t StructuralWorld::nodeCount()const noexcept{return impl_->nodes.size();}
std::size_t StructuralWorld::memberCount()const noexcept{return impl_->memberViews.size();}
std::size_t StructuralWorld::brokenMemberCount()const noexcept{std::size_t n=0;for(const auto&m:impl_->memberData)if(m.broken)++n;return n;}
std::size_t StructuralWorld::bodyCount()const noexcept{return impl_->particles.size()+impl_->loadData.size();}
float StructuralWorld::simulationTime()const noexcept{return impl_->time;}
int StructuralWorld::workerCount()const noexcept{return impl_->workers;}

void StructuralWorld::resetDemo(){
    clear();
    // A pinned-base portal frame with diagonal bracing and a central roof load.
    NodeId n[9];
    const Vec2 points[]={{5,1},{5,4},{5,7},{9,1},{9,4},{9,7},{13,1},{13,4},{13,7}};
    // All three column feet are supported so the starter experiment remains
    // stable under its own weight before the player adds destructive loads.
    for(int i=0;i<9;++i)n[i]=addNode(points[i],i==0||i==3||i==6);
    const int links[][2]={{0,1},{1,2},{3,4},{4,5},{6,7},{7,8},{0,3},{3,6},{1,4},{4,7},{2,5},{5,8},{0,4},{4,8},{2,4},{4,6}};
    for(const auto& link:links)addMember(n[link[0]],n[link[1]],MaterialKind::Steel,link[0]%3==0?MemberRole::Column:MemberRole::Beam);
    addLoad({9,7.65f},220);
    impl_->rebuildViews();
}

} // namespace framelabs
