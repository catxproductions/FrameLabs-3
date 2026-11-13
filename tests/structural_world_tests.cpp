#include "framelabs/StructuralWorld.hpp"

#include <cassert>
#include <cmath>
#include <iostream>

using namespace framelabs;

namespace {
const LoadView* findLoad(const StructuralWorld& world, std::uint32_t id) {
    for (const auto& load : world.loads()) {
        if (load.id == id) return &load;
    }
    return nullptr;
}

void starterFrameRemainsIntactAtRest() {
    StructuralWorld world;
    assert(world.memberCount() == 16);
    for (int i = 0; i < 120; ++i) world.step(1.0f / 120.0f);
    assert(world.brokenMemberCount() == 0);
}

void loadsContactTheFullLengthOfLongMembers() {
    StructuralWorld world;
    world.clear();
    const NodeId a = world.addNode({1.0f, 5.0f}, true);
    const NodeId b = world.addNode({5.0f, 5.0f}, true);
    assert(world.addMember(a, b, MaterialKind::Steel) != 0);
    const std::uint32_t loadId = world.addLoad({2.2f, 6.2f}, 220.0f);
    for (int i = 0; i < 240; ++i) world.step(1.0f / 120.0f);
    const LoadView* load = findLoad(world, loadId);
    assert(load != nullptr);
    assert(load->position.y > 5.15f);
}

void heatBrushReachesMemberEndpoints() {
    StructuralWorld world;
    world.clear();
    const NodeId a = world.addNode({0.0f, 0.0f}, true);
    const NodeId b = world.addNode({4.0f, 0.0f}, true);
    const MemberId memberId = world.addMember(a, b, MaterialKind::Steel);
    assert(memberId != 0);
    world.applyHeat({0.1f, 0.0f}, 0.5f, 500.0f, 1.0f);
    bool heated = false;
    for (const auto& member : world.members()) {
        if (member.id == memberId) heated = member.temperatureC > 20.0f;
    }
    assert(heated);
}
}

int main() {
    starterFrameRemainsIntactAtRest();
    loadsContactTheFullLengthOfLongMembers();
    heatBrushReachesMemberEndpoints();
    std::cout << "FrameLabs 3 structural world regression tests passed.\n";
    return 0;
}
