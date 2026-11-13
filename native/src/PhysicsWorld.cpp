#include "framelabs/PhysicsWorld.hpp"

#include <Jolt/Jolt.h>
#include <Jolt/RegisterTypes.h>
#include <Jolt/Core/Factory.h>
#include <Jolt/Core/JobSystemThreadPool.h>
#include <Jolt/Core/TempAllocator.h>
#include <Jolt/Physics/PhysicsSystem.h>
#include <Jolt/Physics/Body/BodyCreationSettings.h>
#include <Jolt/Physics/Collision/Shape/BoxShape.h>
#include <Jolt/Physics/Collision/Shape/SphereShape.h>

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>
#include <thread>
#include <utility>

namespace {

namespace Layers {
    static constexpr JPH::ObjectLayer NonMoving = 0;
    static constexpr JPH::ObjectLayer Moving = 1;
    static constexpr JPH::ObjectLayer Count = 2;
}

namespace BroadPhaseLayers {
    static constexpr JPH::BroadPhaseLayer NonMoving(0);
    static constexpr JPH::BroadPhaseLayer Moving(1);
    static constexpr JPH::uint Count = 2;
}

class BroadPhaseLayerInterfaceImpl final : public JPH::BroadPhaseLayerInterface {
public:
    BroadPhaseLayerInterfaceImpl() {
        objectToBroadPhase_[Layers::NonMoving] = BroadPhaseLayers::NonMoving;
        objectToBroadPhase_[Layers::Moving] = BroadPhaseLayers::Moving;
    }

    JPH::uint GetNumBroadPhaseLayers() const override {
        return BroadPhaseLayers::Count;
    }

    JPH::BroadPhaseLayer GetBroadPhaseLayer(JPH::ObjectLayer layer) const override {
        JPH_ASSERT(layer < Layers::Count);
        return objectToBroadPhase_[layer];
    }

#if defined(JPH_EXTERNAL_PROFILE) || defined(JPH_PROFILE_ENABLED)
    const char* GetBroadPhaseLayerName(JPH::BroadPhaseLayer layer) const override {
        switch (static_cast<JPH::BroadPhaseLayer::Type>(layer)) {
            case static_cast<JPH::BroadPhaseLayer::Type>(BroadPhaseLayers::NonMoving):
                return "NON_MOVING";
            case static_cast<JPH::BroadPhaseLayer::Type>(BroadPhaseLayers::Moving):
                return "MOVING";
            default:
                JPH_ASSERT(false);
                return "INVALID";
        }
    }
#endif

private:
    JPH::BroadPhaseLayer objectToBroadPhase_[Layers::Count]{};
};

class ObjectVsBroadPhaseLayerFilterImpl final : public JPH::ObjectVsBroadPhaseLayerFilter {
public:
    bool ShouldCollide(JPH::ObjectLayer objectLayer, JPH::BroadPhaseLayer broadPhaseLayer) const override {
        if (objectLayer == Layers::NonMoving) {
            return broadPhaseLayer == BroadPhaseLayers::Moving;
        }
        if (objectLayer == Layers::Moving) {
            return true;
        }
        JPH_ASSERT(false);
        return false;
    }
};

class ObjectLayerPairFilterImpl final : public JPH::ObjectLayerPairFilter {
public:
    bool ShouldCollide(JPH::ObjectLayer first, JPH::ObjectLayer second) const override {
        if (first == Layers::NonMoving) {
            return second == Layers::Moving;
        }
        if (first == Layers::Moving) {
            return true;
        }
        JPH_ASSERT(false);
        return false;
    }
};

void TraceImpl(const char* format, ...) {
    va_list args;
    va_start(args, format);
    std::vfprintf(stderr, format, args);
    std::fputc('\n', stderr);
    va_end(args);
}

constexpr float FixedStepSeconds = 1.0f / 60.0f;
constexpr float MaximumFrameDeltaSeconds = 0.25f;
constexpr int MaximumCatchUpSteps = 8;

} // namespace

namespace framelabs {

struct PhysicsWorld::Impl {
    struct Entry {
        BodyHandle handle = 0;
        JPH::BodyID bodyId;
        PrimitiveShape shape = PrimitiveShape::Box;
        Vec3f halfExtents{0.5f, 0.5f, 0.5f};
        float radius = 0.5f;
        Rgba8 color{};
    };

    BroadPhaseLayerInterfaceImpl broadPhaseLayerInterface;
    ObjectVsBroadPhaseLayerFilterImpl objectVsBroadPhaseLayerFilter;
    ObjectLayerPairFilterImpl objectLayerPairFilter;

    std::unique_ptr<JPH::PhysicsSystem> system;
    std::unique_ptr<JPH::TempAllocatorImpl> tempAllocator;
    std::unique_ptr<JPH::JobSystemThreadPool> jobSystem;

    JPH::BodyID floorBodyId;
    std::vector<Entry> entries;
    std::vector<BodyView> renderViews;
    BodyHandle nextHandle = 1;
    float timeAccumulator = 0.0f;
    bool joltRegistered = false;

    Impl() {
        JPH::RegisterDefaultAllocator();
        JPH::Trace = TraceImpl;

        JPH::Factory::sInstance = new JPH::Factory();
        JPH::RegisterTypes();
        joltRegistered = true;

        tempAllocator = std::make_unique<JPH::TempAllocatorImpl>(16 * 1024 * 1024);

        const unsigned int availableThreads = std::thread::hardware_concurrency();
        const unsigned int workerThreads = std::max(
            1U,
            availableThreads > 1U ? availableThreads - 1U : 1U
        );
        jobSystem = std::make_unique<JPH::JobSystemThreadPool>(
            JPH::cMaxPhysicsJobs,
            JPH::cMaxPhysicsBarriers,
            static_cast<int>(workerThreads)
        );

        system = std::make_unique<JPH::PhysicsSystem>();
        system->Init(
            65536,
            0,
            65536,
            10240,
            broadPhaseLayerInterface,
            objectVsBroadPhaseLayerFilter,
            objectLayerPairFilter
        );
        system->SetGravity(JPH::Vec3(0.0f, -9.81f, 0.0f));

        createFloor();
        entries.reserve(512);
        renderViews.reserve(512);
    }

    ~Impl() {
        if (system) {
            clearDynamicBodies();
            JPH::BodyInterface& bodyInterface = system->GetBodyInterface();
            if (!floorBodyId.IsInvalid()) {
                bodyInterface.RemoveBody(floorBodyId);
                bodyInterface.DestroyBody(floorBodyId);
                floorBodyId = JPH::BodyID();
            }
            system.reset();
        }

        jobSystem.reset();
        tempAllocator.reset();

        if (joltRegistered) {
            JPH::UnregisterTypes();
            delete JPH::Factory::sInstance;
            JPH::Factory::sInstance = nullptr;
        }
    }

    void createFloor() {
        JPH::BodyCreationSettings floorSettings(
            new JPH::BoxShape(JPH::Vec3(80.0f, 0.5f, 80.0f)),
            JPH::RVec3(0.0, -0.5, 0.0),
            JPH::Quat::sIdentity(),
            JPH::EMotionType::Static,
            Layers::NonMoving
        );
        floorSettings.mFriction = 0.95f;
        floorSettings.mRestitution = 0.02f;

        floorBodyId = system->GetBodyInterface().CreateAndAddBody(
            floorSettings,
            JPH::EActivation::DontActivate
        );
    }

    BodyHandle addBox(Vec3f position, Vec3f halfExtents, Rgba8 color) {
        JPH::BodyCreationSettings settings(
            new JPH::BoxShape(JPH::Vec3(halfExtents.x, halfExtents.y, halfExtents.z)),
            JPH::RVec3(position.x, position.y, position.z),
            JPH::Quat::sIdentity(),
            JPH::EMotionType::Dynamic,
            Layers::Moving
        );
        settings.mFriction = 0.78f;
        settings.mRestitution = 0.05f;
        settings.mLinearDamping = 0.025f;
        settings.mAngularDamping = 0.08f;

        const JPH::BodyID id = system->GetBodyInterface().CreateAndAddBody(
            settings,
            JPH::EActivation::Activate
        );
        if (id.IsInvalid()) {
            return 0;
        }

        const BodyHandle handle = nextHandle++;
        entries.push_back(Entry{handle, id, PrimitiveShape::Box, halfExtents, 0.0f, color});
        refreshRenderViews();
        return handle;
    }

    BodyHandle addSphere(Vec3f position, float radius, Rgba8 color) {
        const float safeRadius = std::max(0.05f, radius);
        JPH::BodyCreationSettings settings(
            new JPH::SphereShape(safeRadius),
            JPH::RVec3(position.x, position.y, position.z),
            JPH::Quat::sIdentity(),
            JPH::EMotionType::Dynamic,
            Layers::Moving
        );
        settings.mFriction = 0.55f;
        settings.mRestitution = 0.22f;
        settings.mLinearDamping = 0.015f;
        settings.mAngularDamping = 0.04f;

        const JPH::BodyID id = system->GetBodyInterface().CreateAndAddBody(
            settings,
            JPH::EActivation::Activate
        );
        if (id.IsInvalid()) {
            return 0;
        }

        const Vec3f extents{safeRadius, safeRadius, safeRadius};
        const BodyHandle handle = nextHandle++;
        entries.push_back(Entry{handle, id, PrimitiveShape::Sphere, extents, safeRadius, color});
        refreshRenderViews();
        return handle;
    }

    Entry* findEntry(BodyHandle handle) {
        const auto found = std::find_if(entries.begin(), entries.end(),
            [handle](const Entry& entry) { return entry.handle == handle; });
        return found == entries.end() ? nullptr : &(*found);
    }

    const Entry* findEntry(BodyHandle handle) const {
        const auto found = std::find_if(entries.begin(), entries.end(),
            [handle](const Entry& entry) { return entry.handle == handle; });
        return found == entries.end() ? nullptr : &(*found);
    }

    void removeEntry(Entry& entry) {
        JPH::BodyInterface& bodyInterface = system->GetBodyInterface();
        bodyInterface.RemoveBody(entry.bodyId);
        bodyInterface.DestroyBody(entry.bodyId);
    }

    void clearDynamicBodies() {
        if (!system) {
            entries.clear();
            renderViews.clear();
            return;
        }

        for (Entry& entry : entries) {
            removeEntry(entry);
        }
        entries.clear();
        renderViews.clear();
        timeAccumulator = 0.0f;
    }

    void refreshRenderViews() {
        renderViews.clear();
        renderViews.reserve(entries.size());

        JPH::BodyInterface& bodyInterface = system->GetBodyInterface();
        for (const Entry& entry : entries) {
            JPH::RVec3 position;
            JPH::Quat rotation;
            bodyInterface.GetPositionAndRotation(entry.bodyId, position, rotation);

            const float w = std::clamp(rotation.GetW(), -1.0f, 1.0f);
            const float angle = 2.0f * std::acos(w);
            const float axisScale = std::sqrt(std::max(0.0f, 1.0f - w * w));

            Vec3f axis{0.0f, 1.0f, 0.0f};
            if (axisScale > 0.0001f) {
                axis = {
                    rotation.GetX() / axisScale,
                    rotation.GetY() / axisScale,
                    rotation.GetZ() / axisScale
                };
            }

            BodyView view;
            view.handle = entry.handle;
            view.shape = entry.shape;
            view.position = {
                static_cast<float>(position.GetX()),
                static_cast<float>(position.GetY()),
                static_cast<float>(position.GetZ())
            };
            view.halfExtents = entry.halfExtents;
            view.rotationAxis = axis;
            view.rotationAngleRadians = angle;
            view.radius = entry.radius;
            view.color = entry.color;
            renderViews.push_back(view);
        }
    }

    void step(float frameDeltaSeconds) {
        if (!system || !tempAllocator || !jobSystem) {
            return;
        }

        const float safeDelta = std::clamp(frameDeltaSeconds, 0.0f, MaximumFrameDeltaSeconds);
        timeAccumulator += safeDelta;

        int steps = 0;
        while (timeAccumulator >= FixedStepSeconds && steps < MaximumCatchUpSteps) {
            system->Update(FixedStepSeconds, 1, tempAllocator.get(), jobSystem.get());
            timeAccumulator -= FixedStepSeconds;
            ++steps;
        }

        // Avoid a spiral of death after the window is dragged or heavily stalled.
        if (steps == MaximumCatchUpSteps && timeAccumulator >= FixedStepSeconds) {
            timeAccumulator = std::fmod(timeAccumulator, FixedStepSeconds);
        }

        refreshRenderViews();
    }

    bool removeBody(BodyHandle handle) {
        const auto found = std::find_if(entries.begin(), entries.end(),
            [handle](const Entry& entry) { return entry.handle == handle; });
        if (found == entries.end()) {
            return false;
        }

        removeEntry(*found);
        entries.erase(found);
        refreshRenderViews();
        return true;
    }

    bool setBodyPosition(BodyHandle handle, Vec3f position) {
        Entry* entry = findEntry(handle);
        if (entry == nullptr) {
            return false;
        }

        system->GetBodyInterface().SetPosition(
            entry->bodyId,
            JPH::RVec3(position.x, position.y, position.z),
            JPH::EActivation::Activate
        );
        refreshRenderViews();
        return true;
    }

    bool getBodyPosition(BodyHandle handle, Vec3f& outPosition) const {
        const Entry* entry = findEntry(handle);
        if (entry == nullptr) {
            return false;
        }

        const JPH::RVec3 position = system->GetBodyInterface().GetPosition(entry->bodyId);
        outPosition = {
            static_cast<float>(position.GetX()),
            static_cast<float>(position.GetY()),
            static_cast<float>(position.GetZ())
        };
        return true;
    }
};

PhysicsWorld::PhysicsWorld()
    : impl_(std::make_unique<Impl>()) {
    resetSandbox();
}

PhysicsWorld::~PhysicsWorld() = default;

void PhysicsWorld::step(float frameDeltaSeconds) {
    impl_->step(frameDeltaSeconds);
}

void PhysicsWorld::resetSandbox() {
    impl_->clearDynamicBodies();

    constexpr float halfSize = 0.48f;
    constexpr float spacing = 1.02f;
    constexpr int columns = 3;
    constexpr int rows = 3;
    constexpr int levels = 4;

    const Rgba8 palette[] = {
        {125, 122, 205, 255},
        {105, 145, 192, 255},
        {151, 128, 193, 255},
        {105, 166, 165, 255}
    };

    for (int level = 0; level < levels; ++level) {
        for (int row = 0; row < rows; ++row) {
            for (int column = 0; column < columns; ++column) {
                const Vec3f position{
                    (static_cast<float>(column) - 1.0f) * spacing,
                    halfSize + 0.025f + static_cast<float>(level) * spacing,
                    (static_cast<float>(row) - 1.0f) * spacing
                };
                const Rgba8 color = palette[(level + row + column) % 4];
                impl_->addBox(position, {halfSize, halfSize, halfSize}, color);
            }
        }
    }

    impl_->addSphere({3.2f, 5.0f, 0.0f}, 0.62f, {196, 162, 112, 255});
    impl_->system->OptimizeBroadPhase();
    impl_->refreshRenderViews();
}

BodyHandle PhysicsWorld::addBox(Vec3f position, Vec3f halfExtents, Rgba8 color) {
    return impl_->addBox(position, halfExtents, color);
}

BodyHandle PhysicsWorld::addSphere(Vec3f position, float radius, Rgba8 color) {
    return impl_->addSphere(position, radius, color);
}

bool PhysicsWorld::removeBody(BodyHandle handle) {
    return impl_->removeBody(handle);
}

bool PhysicsWorld::setBodyPosition(BodyHandle handle, Vec3f position) {
    return impl_->setBodyPosition(handle, position);
}

bool PhysicsWorld::getBodyPosition(BodyHandle handle, Vec3f& outPosition) const {
    return impl_->getBodyPosition(handle, outPosition);
}

const std::vector<BodyView>& PhysicsWorld::bodies() const noexcept {
    return impl_->renderViews;
}

std::size_t PhysicsWorld::bodyCount() const noexcept {
    return impl_->entries.size();
}

} // namespace framelabs
