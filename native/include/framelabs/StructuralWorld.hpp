#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <vector>

namespace framelabs {

using NodeId = std::uint32_t;
using MemberId = std::uint32_t;

struct Vec2 {
    float x = 0.0f;
    float y = 0.0f;
};

struct Rgb8 {
    std::uint8_t r = 255;
    std::uint8_t g = 255;
    std::uint8_t b = 255;
};

enum class MaterialKind : std::uint8_t {
    Steel,
    Wood,
    Composite
};

struct MaterialProfile {
    const char* id = "";
    const char* label = "";
    Rgb8 color{};

    // Illustrative game values, not certified engineering properties.
    float density = 1.0f;
    float linearBendHertz = 20.0f;
    float angularBendHertz = 12.0f;
    float ultimateForcePerThickness = 1.0f;
    float ultimateMomentPerThickness = 1.0f;
    float yieldBendRadians = 0.05f;
    float breakBendRadians = 0.2f;
    float breakStrain = 0.08f;
    float heatSoftening = 0.7f;
    float heatWeakening = 0.7f;
    float fatigueSeconds = 1.5f;
};

const MaterialProfile& materialProfile(MaterialKind kind) noexcept;

struct NodeView {
    NodeId id = 0;
    Vec2 position{};
    bool pinned = false;
};

struct SegmentView {
    Vec2 center{};
    float angleRadians = 0.0f;
    float length = 1.0f;
    float thickness = 0.16f;
};

struct MemberView {
    MemberId id = 0;
    NodeId nodeA = 0;
    NodeId nodeB = 0;
    MaterialKind material = MaterialKind::Steel;
    Vec2 start{};
    Vec2 end{};
    float restLength = 0.0f;
    float currentLength = 0.0f;
    float axialStrain = 0.0f;
    float stressRatio = 0.0f;
    float damage = 0.0f;
    float temperatureC = 20.0f;
    float maxBendRadians = 0.0f;
    bool broken = false;
    bool yielding = false;
    std::vector<SegmentView> segments;
};

struct LoadView {
    std::uint32_t id = 0;
    Vec2 position{};
    float radius = 0.45f;
    float massKg = 100.0f;
};

/// Native 2D structural world.
///
/// Box2D owns collisions, rigid-body integration, and the joint solver. FrameLabs
/// owns the structure graph, material response, stress/fatigue model, heat, and
/// structural-member fracture. A fractured member leaves its segments as debris.
class StructuralWorld {
public:
    StructuralWorld();
    ~StructuralWorld();

    StructuralWorld(const StructuralWorld&) = delete;
    StructuralWorld& operator=(const StructuralWorld&) = delete;
    StructuralWorld(StructuralWorld&&) = delete;
    StructuralWorld& operator=(StructuralWorld&&) = delete;

    void resetDemo();
    void clear();

    NodeId addNode(Vec2 position, bool pinned);
    NodeId findNodeNear(Vec2 position, float radius) const;
    bool toggleNodePin(NodeId id);
    bool getNodePosition(NodeId id, Vec2& outPosition) const;

    MemberId addMember(NodeId nodeA, NodeId nodeB, MaterialKind material);
    bool removeMember(MemberId id);
    MemberId findMemberNear(Vec2 point, float radius) const;

    std::uint32_t addLoad(Vec2 position, float massKg = 110.0f);
    void applyHeat(Vec2 position, float radius, float degreesPerSecond, float deltaSeconds);
    void setWind(float normalizedStrength) noexcept;
    void step(float deltaSeconds);

    const std::vector<NodeView>& nodes() const noexcept;
    const std::vector<MemberView>& members() const noexcept;
    const std::vector<LoadView>& loads() const noexcept;

    std::size_t nodeCount() const noexcept;
    std::size_t memberCount() const noexcept;
    std::size_t brokenMemberCount() const noexcept;
    std::size_t bodyCount() const noexcept;
    float simulationTime() const noexcept;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace framelabs
