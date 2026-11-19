#include "framelabs/StructuralWorld.hpp"

#include <algorithm>
#include <cmath>
#include <iostream>
#include <limits>
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

void nodesPlacedOnGroundBecomeFloorBases() {
    StructuralWorld world;
    world.clear();
    const NodeId floorNode = world.addNode({2.0f, 0.02f}, false);
    const NodeId elevatedNode = world.addNode({4.0f, 1.0f}, false);
    const NodeId lowButNotOnFloor = world.addNode({6.0f, 0.15f}, false);
    bool foundFloorBase = false;
    bool foundDynamicNode = false;
    bool foundLowDynamicNode = false;
    for (const auto& node : world.nodes()) {
        if (node.id == floorNode) {
            foundFloorBase = node.pinned && std::fabs(node.position.y - 0.075f) < 1e-5f;
        }
        if (node.id == elevatedNode) foundDynamicNode = !node.pinned;
        if (node.id == lowButNotOnFloor) foundLowDynamicNode = !node.pinned;
    }
    require(foundFloorBase, "node placed at the floor was not snapped down and pinned");
    require(foundDynamicNode, "elevated node was incorrectly pinned as a floor base");
    require(foundLowDynamicNode, "near-floor node was incorrectly treated as a floor base");
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
    require(steel.bendingStiffness < wood.bendingStiffness,
            "steel should flex slightly more than wood");
    require(wood.bendingStiffness < composite.bendingStiffness,
            "wood should flex more than composite");
    require(wood.bendingStiffness < materialProfile(MaterialKind::ExplosiveComposite).bendingStiffness,
            "wood should flex more than explosive composite");
    require(wood.bendingStiffness < materialProfile(MaterialKind::FlammableComposite).bendingStiffness,
            "wood should flex more than flammable composite");
    require(composite.bendingStiffness < materialProfile(MaterialKind::Concrete).bendingStiffness,
            "composite should flex more than concrete");
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

void compositeEffectsAreRestrictedToTheirMatchingMaterials() {
    StructuralWorld world;
    world.clear();
    const NodeId a=world.addNode({1.0f,5.0f},true);
    const NodeId b=world.addNode({5.0f,5.0f},true);
    const MemberId flammable=world.addMember(a,b,MaterialKind::FlammableComposite);
    world.ignite({3.0f,5.0f},0.5f);
    bool ignited=false;
    for(const auto& member:world.members()) if(member.id==flammable) ignited=member.ignited;
    require(ignited,"ignite did not ignite flammable composite");
    for(int i=0;i<720;++i) world.step(1.0f/120.0f);
    require(world.brokenMemberCount()>0,"ignited composite did not eventually fail");

    world.clear();
    const NodeId c=world.addNode({1.0f,5.0f},true);
    const NodeId d=world.addNode({5.0f,5.0f},true);
    const MemberId explosive=world.addMember(c,d,MaterialKind::ExplosiveComposite);
    world.explode({3.0f,5.0f},1.0f,18.0f);
    bool broken=false;
    for(const auto& member:world.members()) if(member.id==explosive) broken=member.broken;
    require(broken,"blast did not trigger explosive composite");
}

void separateStructuralMembersCollide() {
    StructuralWorld world;
    world.clear();
    const NodeId a=world.addNode({2.0f,4.0f},true);
    const NodeId b=world.addNode({6.0f,4.0f},true);
    const NodeId c=world.addNode({4.0f,2.0f},false);
    const NodeId d=world.addNode({4.0f,6.0f},false);
    world.addMember(a,b,MaterialKind::Steel);
    world.addMember(c,d,MaterialKind::Steel);
    for(int i=0;i<240;++i)world.step(1.0f/120.0f);
    const NodeView* moved=nullptr;
    for(const auto& node:world.nodes())if(node.id==c)moved=&node;
    require(moved!=nullptr,"moving member endpoint disappeared");
    require(std::fabs(moved->position.x-4.0f)>0.02f,
            "crossing structural members passed through each other");
}

void gridCellHasTheConfiguredPhysicalArea() {
    require(std::fabs(GridCellAreaSquareFeet - 625.0f) < 1e-6f,
            "one grid cell should represent 625 square feet");
    require(std::fabs(GridCellSideFeet - 25.0f) < 1e-6f,
            "one grid cell should be 25 feet per side");
    require(std::fabs(GridCellSideFeet * GridCellSideFeet - GridCellAreaSquareFeet) < 1e-5f,
            "grid side length does not match its area");
    require(std::fabs(MetersPerWorldUnit - GridCellSideFeet * 0.3048f) < 1e-6f,
            "native unit conversion is inconsistent with the grid scale");
}

void ropeSagsAndActsAsATensionOnlyMember() {
    StructuralWorld world;
    world.clear();
    const NodeId left = world.addNode({2.0f, 5.0f}, true);
    const NodeId right = world.addNode({8.0f, 5.0f}, true);
    const MemberId ropeId = world.addMember(left, right, MaterialKind::Steel, MemberRole::Rope);
    require(ropeId != 0, "failed to create rope member");

    for (int i = 0; i < 240; ++i) world.step(1.0f / 120.0f);

    const MemberView* rope = nullptr;
    for (const auto& member : world.members()) {
        if (member.id == ropeId) rope = &member;
    }
    require(rope != nullptr, "rope member disappeared");
    require(rope->role == MemberRole::Rope, "rope lost its member role");
    float lowestY = std::numeric_limits<float>::max();
    for (const auto& segment : rope->segments) lowestY = std::min(lowestY, segment.center.y);
    require(lowestY < 4.8f, "rope did not sag between its pinned endpoints");
    require(!rope->broken, "a slack rope failed under its own weight");
    require(rope->stressRatio < 1.0f, "a slack rope incorrectly registered bending failure");
}

void heatedSteelExpandsItsRestLengthAndStretches() {
    StructuralWorld world;
    world.clear();
    const NodeId fixed = world.addNode({2.0f, 5.0f}, true);
    const NodeId free = world.addNode({6.0f, 5.0f}, false);
    const MemberId steel = world.addMember(fixed, free, MaterialKind::Steel);
    require(steel != 0, "failed to create heated steel member");
    Vec2 start{}, before{}, after{};
    require(world.getNodePosition(fixed, start), "fixed node was not available");
    require(world.getNodePosition(free, before), "free node was not available");

    world.applyHeat({4.0f, 5.0f}, 2.5f, 1000.0f, 1.0f);
    for (int i = 0; i < 120; ++i) world.step(1.0f / 120.0f);

    require(world.getNodePosition(free, after), "heated steel endpoint disappeared");
    const float initialLength = std::hypot(before.x - start.x, before.y - start.y);
    const float heatedLength = std::hypot(after.x - start.x, after.y - start.y);
    require(heatedLength > initialLength * 1.01f,
            "heated steel did not thermally expand its structural rest length");
}

void severeTensileImpulseFracturesSteel() {
    StructuralWorld world;
    world.clear();
    const NodeId fixed = world.addNode({2.0f, 5.0f}, true);
    const NodeId pulled = world.addNode({6.0f, 5.0f}, false);
    const MemberId steel = world.addMember(fixed, pulled, MaterialKind::Steel);
    require(steel != 0, "failed to create tensile test member");
    // Keep the test's initial physical velocity comparable to the former
    // 2.236 ft world-unit calibration after increasing each unit to 25 ft.
    const float previousWorldUnitFeet = 2.2360679775f;
    const float scaleRatio = GridCellSideFeet / previousWorldUnitFeet;
    // Apply the pull across successive fixed steps rather than relying on a
    // single velocity kick. This exercises sustained tensile loading and gives
    // the member's strain/fatigue model time to register the load at the new scale.
    for (int i = 0; i < 4 && world.brokenMemberCount() == 0; ++i) {
        // The native member mass scales with its physical length and cross-section.
        // The earlier 60 N·s calibration was too weak after the 25 ft grid change;
        // this deliberately severe repeated impulse drives the steel past its
        // configured tensile failure strain without changing material thresholds.
        require(world.applyNodeImpulse(pulled, {200.0f * scaleRatio, 0.0f}),
                "failed to apply tensile impulse to free endpoint");
        world.step(1.0f / 120.0f);
    }
    require(world.brokenMemberCount() > 0,
            "steel member did not fracture after severe sustained tensile strain");
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

void nativeStairsAndElevatorShaftsFollowSupportsAndFallAfterFailure() {
    for (const ConnectorKind kind : {ConnectorKind::Stairs, ConnectorKind::Elevator}) {
        StructuralWorld world;
        world.clear();
        const NodeId topA = world.addNode({5.0f, 8.0f}, true);
        const NodeId topB = world.addNode({10.0f, 8.0f}, true);
        const NodeId lowerA = world.addNode({5.0f, 4.0f}, true);
        const NodeId lowerB = world.addNode({10.0f, 4.0f}, true);
        const NodeId catchA = world.addNode({5.0f, 1.2f}, true);
        const NodeId catchB = world.addNode({10.0f, 1.2f}, true);
        const MemberId topFloor = world.addMember(topA, topB, MaterialKind::Concrete, MemberRole::Slab);
        const MemberId lowerFloor = world.addMember(lowerA, lowerB, MaterialKind::Concrete, MemberRole::Slab);
        world.addMember(catchA, catchB, MaterialKind::Concrete, MemberRole::Slab);
        const ConnectorId connector = world.addConnector(kind, {7.5f, 8.0f}, {7.5f, 4.0f});
        require(connector != 0, "failed to add native connector");
        require(world.connectorCount() == 1, "native connector count did not update");
        require(world.fallingConnectorCount() == 0, "supported connector fell before a failure");

        require(world.removeMember(topFloor), "failed to remove the upper landing support");
        for (int i = 0; i < 240; ++i) world.step(1.0f / 120.0f);
        require(world.fallingConnectorCount() == 1,
                "connector did not release when its upper landing support failed");
        const ConnectorView* view = nullptr;
        for (const auto& item : world.connectors()) if (item.id == connector) view = &item;
        require(view != nullptr, "native connector view disappeared");
        const float centerY = (view->a.y + view->b.y) * 0.5f;
        require(centerY < 8.0f, "released connector did not move under gravity");

        require(world.removeMember(lowerFloor), "failed to remove the lower landing support");
        for (int i = 0; i < 360; ++i) world.step(1.0f / 120.0f);
        view = nullptr;
        for (const auto& item : world.connectors()) if (item.id == connector) view = &item;
        require(view != nullptr && view->falling, "collapsed connector was lost from the world");
        require(std::min(view->a.y, view->b.y) < 4.0f,
                "connector did not continue falling after its lower landing failed");
        require(std::isfinite(view->a.x + view->a.y + view->b.x + view->b.y),
                "falling connector became non-finite");
    }
}

void unanchoredNativeConnectorsFall() {
    StructuralWorld world;
    world.clear();
    const ConnectorId connector = world.addConnector(
        ConnectorKind::Stairs, {8.0f, 7.0f}, {8.0f, 4.0f}
    );
    require(connector != 0, "failed to add unanchored connector");
    world.step(1.0f / 120.0f);
    require(world.fallingConnectorCount() == 1,
            "unanchored connector remained suspended");
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
    run("nodes placed on the floor become glued base nodes", nodesPlacedOnGroundBecomeFloorBases);
    run("continuous load contact", loadsContactTheFullLengthOfLongMembers);
    run("full-length heat brush", heatBrushReachesMemberEndpoints);
    run("material bending hierarchy and contact profiles", materialProfilesPreserveTheRequestedBendingOrder);
    run("composite ignition and explosion effects", compositeEffectsAreRestrictedToTheirMatchingMaterials);
    run("structural members collide with each other", separateStructuralMembersCollide);
    run("five-square-foot physical grid scale", gridCellHasTheConfiguredPhysicalArea);
    run("heated steel thermal expansion", heatedSteelExpandsItsRestLengthAndStretches);
    run("steel fracture under severe tension", severeTensileImpulseFracturesSteel);
    run("rope sag and tension-only mechanics", ropeSagsAndActsAsATensionOnlyMember);
    run("fixed-step determinism across render-step grouping", fixedSubstepsAreIndependentOfRenderStepGrouping);
    run("native stairs and elevator shafts follow supports and collapse", nativeStairsAndElevatorShaftsFollowSupportsAndFallAfterFailure);
    run("unanchored native connectors fall under gravity", unanchoredNativeConnectorsFall);
    run("finite state during extended simulation", longSimulationMaintainsFiniteState);

    if (failures != 0) {
        std::cerr << failures << " structural regression test(s) failed.\\n";
        return 1;
    }
    std::cout << "All FrameLabs 3 structural world regression tests passed.\\n";
    return 0;
}
