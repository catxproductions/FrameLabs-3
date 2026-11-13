#include "framelabs/StructuralWorld.hpp"

#include <cmath>
#include <iostream>
#include <stdexcept>

using namespace framelabs;

namespace {
void require(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}

const LoadView* findLoad(const StructuralWorld& world, std::uint32_t id) {
    for (const auto& load : world.loads()) {
        if (load.id == id) return &load;
    }
    return nullptr;
}

void starterFrameRemainsIntactAtRest() {
    StructuralWorld world;
    require(world.memberCount() == 16, "starter frame should contain 16 members");
    for (int i = 0; i < 120; ++i) world.step(1.0f / 120.0f);
    if (world.brokenMemberCount() != 0) {
        std::cerr << "Broken starter members after 1 second: " << world.brokenMemberCount() << '\\n';
        for (const auto& member : world.members()) {
            if (member.broken) {
                std::cerr << "member=" << member.id
                          << " stress=" << member.stressRatio
                          << " bend=" << member.maxBendRadians
                          << " strain=" << member.axialStrain
                          << " temp=" << member.temperatureC << '\\n';
            }
        }
    }
    require(world.brokenMemberCount() == 0, "starter frame fractured under its own weight");
}

void starterFrameRemainsIntactWithoutTestLoad() {
    StructuralWorld world;
    require(!world.loads().empty(), "starter frame should include its demonstration load");
    const std::uint32_t loadId = world.loads().front().id;
    require(world.removeLoad(loadId), "failed to remove demonstration load");
    for (int i = 0; i < 120; ++i) world.step(1.0f / 120.0f);
    require(world.brokenMemberCount() == 0, "unsupported starter frame fractured without an external load");
}

void loadsContactTheFullLengthOfLongMembers() {
    StructuralWorld world;
    world.clear();
    const NodeId a = world.addNode({1.0f, 5.0f}, true);
    const NodeId b = world.addNode({5.0f, 5.0f}, true);
    require(world.addMember(a, b, MaterialKind::Steel) != 0, "failed to create test beam");
    const std::uint32_t loadId = world.addLoad({2.2f, 6.2f}, 220.0f);
    for (int i = 0; i < 240; ++i) world.step(1.0f / 120.0f);
    const LoadView* load = findLoad(world, loadId);
    require(load != nullptr, "test load disappeared");
    require(load->position.y > 5.15f, "load passed through the middle of a long beam");
}

void heatBrushReachesMemberEndpoints() {
    StructuralWorld world;
    world.clear();
    const NodeId a = world.addNode({0.0f, 0.0f}, true);
    const NodeId b = world.addNode({4.0f, 0.0f}, true);
    const MemberId memberId = world.addMember(a, b, MaterialKind::Steel);
    require(memberId != 0, "failed to create heat test member");
    world.applyHeat({0.1f, 0.0f}, 0.5f, 500.0f, 1.0f);
    bool heated = false;
    for (const auto& member : world.members()) {
        if (member.id == memberId) heated = member.temperatureC > 20.0f;
    }
    require(heated, "heat brush did not reach the member endpoint");
}

void materialProfilesPreserveTheRequestedBendingOrder() {
    const auto& steel = materialProfile(MaterialKind::Steel);
    const auto& wood = materialProfile(MaterialKind::Wood);
    const auto& composite = materialProfile(MaterialKind::Composite);
    require(steel.angularBendHertz < wood.angularBendHertz,
            "steel should be more elastically flexible than wood");
    require(wood.angularBendHertz < composite.angularBendHertz,
            "wood should be more elastically flexible than composite");
    require(steel.breakBendRadians > wood.breakBendRadians,
            "steel should tolerate more bending than wood");
    require(wood.breakBendRadians > composite.breakBendRadians,
            "wood should tolerate more bending than composite");
    require(steel.density > wood.density,
            "steel should be denser than wood");
    require(wood.staticFriction > steel.staticFriction,
            "wood should preserve its distinct contact profile");
}

void fixedSubstepsAreIndependentOfRenderStepGrouping() {
    StructuralWorld oneLargeStep;
    StructuralWorld twoSmallSteps;
    oneLargeStep.step(1.0f / 60.0f);
    twoSmallSteps.step(1.0f / 120.0f);
    twoSmallSteps.step(1.0f / 120.0f);
    require(oneLargeStep.nodes().size() == twoSmallSteps.nodes().size(),
            "step grouping changed node count");
    for (std::size_t i = 0; i < oneLargeStep.nodes().size(); ++i) {
        const auto& a = oneLargeStep.nodes()[i].position;
        const auto& b = twoSmallSteps.nodes()[i].position;
        require(std::fabs(a.x - b.x) < 1e-4f && std::fabs(a.y - b.y) < 1e-4f,
                "same elapsed time produced different node positions");
    }
    require(std::fabs(oneLargeStep.simulationTime() - twoSmallSteps.simulationTime()) < 1e-5f,
            "fixed-step simulation time is not deterministic");
}

void longSimulationMaintainsFiniteState() {
    StructuralWorld world;
    for (int i = 0; i < 1200; ++i) world.step(1.0f / 120.0f);
    for (const auto& node : world.nodes()) {
        require(std::isfinite(node.position.x) && std::isfinite(node.position.y),
                "node position became non-finite");
    }
    for (const auto& member : world.members()) {
        require(std::isfinite(member.stressRatio) &&
                std::isfinite(member.currentLength) &&
                std::isfinite(member.temperatureC),
                "member state became non-finite");
        for (const auto& segment : member.segments) {
            require(std::isfinite(segment.center.x) && std::isfinite(segment.center.y) &&
                    std::isfinite(segment.angleRadians) && std::isfinite(segment.length),
                    "member segment became non-finite");
        }
    }
    for (const auto& load : world.loads()) {
        require(std::isfinite(load.position.x) && std::isfinite(load.position.y),
                "load position became non-finite");
    }
}
}

int main() {
    int failures = 0;
    const auto run = [&](const char* name, const auto& test) {
        try {
            test();
            std::cout << "[PASS] " << name << '\\n';
        } catch (const std::exception& error) {
            ++failures;
            std::cerr << "[FAIL] " << name << ": " << error.what() << '\\n';
        }
    };

    run("starter frame stability with demonstration load", starterFrameRemainsIntactAtRest);
    run("starter frame stability without demonstration load", starterFrameRemainsIntactWithoutTestLoad);
    run("continuous load contact", loadsContactTheFullLengthOfLongMembers);
    run("full-length heat brush", heatBrushReachesMemberEndpoints);
    run("material bending hierarchy and contact profiles", materialProfilesPreserveTheRequestedBendingOrder);
    run("fixed-step determinism across render-step grouping", fixedSubstepsAreIndependentOfRenderStepGrouping);
    run("finite state during extended simulation", longSimulationMaintainsFiniteState);

    if (failures != 0) {
        std::cerr << failures << " structural regression test(s) failed.\\n";
        return 1;
    }
    std::cout << "All FrameLabs 3 structural world regression tests passed.\\n";
    return 0;
}
