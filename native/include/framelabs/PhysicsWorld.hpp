#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <vector>

namespace framelabs {

using BodyHandle = std::uint32_t;

struct Vec3f {
    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;
};

struct Rgba8 {
    std::uint8_t r = 255;
    std::uint8_t g = 255;
    std::uint8_t b = 255;
    std::uint8_t a = 255;
};

enum class PrimitiveShape : std::uint8_t {
    Box,
    Sphere
};

struct BodyView {
    BodyHandle handle = 0;
    PrimitiveShape shape = PrimitiveShape::Box;
    Vec3f position{};
    Vec3f halfExtents{0.5f, 0.5f, 0.5f};
    Vec3f rotationAxis{0.0f, 1.0f, 0.0f};
    float rotationAngleRadians = 0.0f;
    float radius = 0.5f;
    Rgba8 color{};
};

/// Owns the first playable sandbox's rigid-body world.
///
/// The renderer only receives BodyView snapshots; Jolt types remain private to
/// the implementation so the UI and rendering layer are not coupled to Jolt.
class PhysicsWorld {
public:
    PhysicsWorld();
    ~PhysicsWorld();

    PhysicsWorld(const PhysicsWorld&) = delete;
    PhysicsWorld& operator=(const PhysicsWorld&) = delete;
    PhysicsWorld(PhysicsWorld&&) = delete;
    PhysicsWorld& operator=(PhysicsWorld&&) = delete;

    void step(float frameDeltaSeconds);
    void resetSandbox();

    BodyHandle addBox(Vec3f position, Vec3f halfExtents, Rgba8 color);
    BodyHandle addSphere(Vec3f position, float radius, Rgba8 color);

    bool removeBody(BodyHandle handle);
    bool setBodyPosition(BodyHandle handle, Vec3f position);
    bool getBodyPosition(BodyHandle handle, Vec3f& outPosition) const;

    const std::vector<BodyView>& bodies() const noexcept;
    std::size_t bodyCount() const noexcept;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace framelabs
