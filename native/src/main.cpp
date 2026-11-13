#include "framelabs/PhysicsWorld.hpp"

#include <raylib.h>

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <string>

namespace {

using framelabs::BodyHandle;
using framelabs::BodyView;
using framelabs::PhysicsWorld;
using framelabs::PrimitiveShape;
using framelabs::Rgba8;
using framelabs::Vec3f;

constexpr int InitialWidth = 1600;
constexpr int InitialHeight = 900;
constexpr int TopBarHeight = 58;
constexpr int SidebarWidth = 310;
constexpr float Pi = 3.14159265358979323846f;

const Color ColorBlack{5, 5, 10, 255};
const Color ColorPanel{8, 8, 17, 255};
const Color ColorPanelLight{17, 17, 35, 255};
const Color ColorWorkspace{20, 20, 44, 255};
const Color ColorPurple{117, 114, 199, 255};
const Color ColorLilac{191, 188, 245, 255};
const Color ColorText{224, 222, 250, 255};
const Color ColorMuted{130, 128, 164, 255};
const Color ColorLine{53, 52, 84, 255};
const Color ColorGreen{111, 190, 160, 255};

enum class Screen {
    Menu,
    Workspace,
    Settings
};

enum class Tool {
    Select,
    Move,
    PlaceBox,
    PlaceSphere
};

struct CameraOrbit {
    float yaw = -0.78f;
    float pitch = 0.42f;
    float distance = 17.0f;
    Vector3 target{0.0f, 2.0f, 0.0f};
};

struct ApplicationState {
    Screen screen = Screen::Menu;
    Tool tool = Tool::Select;
    CameraOrbit orbit{};
    BodyHandle selectedBody = 0;
    bool paused = false;
    bool draggingBody = false;
    int frameLimit = 120;
    std::string status = "Sandbox ready";
};

Vector3 toRaylib(Vec3f value) {
    return Vector3{value.x, value.y, value.z};
}

Vector3 toRaylibAxis(const BodyView& body) {
    return Vector3{
        body.rotationAxis.x,
        body.rotationAxis.y,
        body.rotationAxis.z
    };
}

Color toRaylibColor(Rgba8 color) {
    return Color{color.r, color.g, color.b, color.a};
}

float clampFloat(float value, float low, float high) {
    return std::max(low, std::min(value, high));
}

int viewportWidth() {
    return std::max(1, GetScreenWidth() - SidebarWidth);
}

Rectangle viewportRectangle() {
    return Rectangle{
        0.0f,
        static_cast<float>(TopBarHeight),
        static_cast<float>(viewportWidth()),
        static_cast<float>(std::max(1, GetScreenHeight() - TopBarHeight))
    };
}

bool mouseInsideViewport(Vector2 mouse) {
    return CheckCollisionPointRec(mouse, viewportRectangle());
}

Camera3D makeCamera(const CameraOrbit& orbit) {
    const float horizontal = std::cos(orbit.pitch) * orbit.distance;

    Camera3D camera{};
    camera.position = Vector3{
        orbit.target.x + std::cos(orbit.yaw) * horizontal,
        orbit.target.y + std::sin(orbit.pitch) * orbit.distance,
        orbit.target.z + std::sin(orbit.yaw) * horizontal
    };
    camera.target = orbit.target;
    camera.up = Vector3{0.0f, 1.0f, 0.0f};
    camera.fovy = 45.0f;
    camera.projection = CAMERA_PERSPECTIVE;
    return camera;
}

void updateCamera(CameraOrbit& orbit) {
    const Vector2 mouse = GetMousePosition();
    if (mouseInsideViewport(mouse) && IsMouseButtonDown(MOUSE_BUTTON_RIGHT)) {
        const Vector2 delta = GetMouseDelta();
        orbit.yaw -= delta.x * 0.006f;
        orbit.pitch = clampFloat(orbit.pitch + delta.y * 0.005f, -0.12f, 1.25f);
    }

    if (mouseInsideViewport(mouse)) {
        orbit.distance = clampFloat(
            orbit.distance - GetMouseWheelMove() * 1.25f,
            5.0f,
            55.0f
        );
    }
}

Ray makeMouseRay(const Camera3D& camera) {
    return GetScreenToWorldRay(GetMousePosition(), camera);
}

bool intersectHorizontalPlane(const Ray& ray, float height, Vector3& outPoint) {
    if (std::fabs(ray.direction.y) < 0.0001f) {
        return false;
    }

    const float distance = (height - ray.position.y) / ray.direction.y;
    if (distance < 0.0f) {
        return false;
    }

    outPoint = Vector3{
        ray.position.x + ray.direction.x * distance,
        height,
        ray.position.z + ray.direction.z * distance
    };
    return true;
}

const BodyView* findBody(const PhysicsWorld& physics, BodyHandle handle) {
    if (handle == 0) {
        return nullptr;
    }

    for (const BodyView& body : physics.bodies()) {
        if (body.handle == handle) {
            return &body;
        }
    }
    return nullptr;
}

BodyHandle pickBody(const PhysicsWorld& physics, const Camera3D& camera, Vector2 mouse) {
    const Ray ray = GetScreenToWorldRay(mouse, camera);
    float nearestDistance = 1.0e30f;
    BodyHandle nearestBody = 0;

    for (const BodyView& body : physics.bodies()) {
        const Vector3 center = toRaylib(body.position);
        float pickRadius = body.radius * 1.25f;

        if (body.shape == PrimitiveShape::Box) {
            pickRadius = std::sqrt(
                body.halfExtents.x * body.halfExtents.x +
                body.halfExtents.y * body.halfExtents.y +
                body.halfExtents.z * body.halfExtents.z
            ) * 1.1f;
        }

        const RayCollision hit = GetRayCollisionSphere(ray, center, std::max(pickRadius, 0.25f));
        if (hit.hit && hit.distance < nearestDistance) {
            nearestDistance = hit.distance;
            nearestBody = body.handle;
        }
    }

    return nearestBody;
}

void drawWorld(
    const PhysicsWorld& physics,
    const Camera3D& camera,
    const Model& cubeModel,
    BodyHandle selectedBody
) {
    BeginScissorMode(0, TopBarHeight, viewportWidth(), GetScreenHeight() - TopBarHeight);
    BeginMode3D(camera);

    DrawPlane(Vector3{0.0f, -0.025f, 0.0f}, Vector2{160.0f, 160.0f}, Color{16, 16, 34, 255});
    DrawGrid(80, 1.0f);

    // World-axis markers make orientation easier to read while orbiting.
    DrawLine3D(Vector3{0, 0.015f, 0}, Vector3{3.0f, 0.015f, 0}, Color{196, 105, 115, 255});
    DrawLine3D(Vector3{0, 0.015f, 0}, Vector3{0, 3.0f, 0}, Color{105, 190, 150, 255});
    DrawLine3D(Vector3{0, 0.015f, 0}, Vector3{0, 0.015f, 3.0f}, Color{112, 150, 216, 255});

    for (const BodyView& body : physics.bodies()) {
        const Vector3 position = toRaylib(body.position);
        const Vector3 axis = toRaylibAxis(body);
        const float angleDegrees = body.rotationAngleRadians * (180.0f / Pi);
        const Color color = toRaylibColor(body.color);
        const bool selected = body.handle == selectedBody;

        if (body.shape == PrimitiveShape::Box) {
            const Vector3 size{
                body.halfExtents.x * 2.0f,
                body.halfExtents.y * 2.0f,
                body.halfExtents.z * 2.0f
            };

            DrawModelEx(cubeModel, position, axis, angleDegrees, size, color);
            DrawModelWiresEx(
                cubeModel,
                position,
                axis,
                angleDegrees,
                size,
                selected ? ColorLilac : Color{33, 32, 61, 190}
            );
        } else {
            DrawSphereEx(position, body.radius, 20, 24, color);
            DrawSphereWires(
                position,
                body.radius + 0.012f,
                12,
                16,
                selected ? ColorLilac : Color{42, 41, 74, 210}
            );
        }

        if (selected) {
            DrawLine3D(
                Vector3{position.x, position.y + 0.9f, position.z},
                Vector3{position.x, position.y + 1.35f, position.z},
                ColorLilac
            );
        }
    }

    EndMode3D();
    EndScissorMode();
}

bool drawButton(Rectangle bounds, const char* label, bool active, Vector2 mouse) {
    const bool hovered = CheckCollisionPointRec(mouse, bounds);
    const Color fill = active
        ? Color{55, 53, 105, 255}
        : (hovered ? Color{28, 28, 57, 255} : Color{15, 15, 30, 255});
    const Color border = active
        ? ColorPurple
        : (hovered ? Color{100, 97, 156, 255} : ColorLine);

    DrawRectangleRounded(bounds, 0.09f, 8, fill);
    DrawRectangleLinesEx(bounds, 1.0f, border);
    DrawText(
        label,
        static_cast<int>(bounds.x + 12.0f),
        static_cast<int>(bounds.y + bounds.height * 0.5f - 7.0f),
        13,
        active ? ColorText : ColorMuted
    );

    return hovered && IsMouseButtonReleased(MOUSE_BUTTON_LEFT);
}

void drawBrand(int x, int y) {
    DrawRectangleLines(x, y, 27, 27, Color{99, 96, 167, 255});
    DrawRectangle(x + 6, y + 15, 4, 7, Color{111, 109, 191, 255});
    DrawRectangle(x + 12, y + 9, 4, 13, Color{143, 140, 214, 255});
    DrawRectangle(x + 18, y + 4, 4, 18, ColorLilac);
}

void drawTopBar(const ApplicationState& state) {
    DrawRectangle(0, 0, GetScreenWidth(), TopBarHeight, ColorBlack);
    DrawLine(0, TopBarHeight - 1, GetScreenWidth(), TopBarHeight - 1, ColorLine);
    drawBrand(18, 15);
    DrawText("FRAMELABS", 58, 15, 16, ColorLilac);
    DrawText("3", 147, 15, 16, ColorPurple);
    DrawText("SANDBOX  /  NATIVE PREVIEW", 180, 20, 9, ColorMuted);

    const char* status = state.paused ? "SIMULATION PAUSED" : "SIMULATION RUNNING";
    const Color statusColor = state.paused ? Color{203, 174, 119, 255} : ColorGreen;
    const int statusWidth = MeasureText(status, 9);
    DrawCircle(GetScreenWidth() - SidebarWidth - statusWidth - 42, 28, 3.0f, statusColor);
    DrawText(status, GetScreenWidth() - SidebarWidth - statusWidth - 32, 23, 9, statusColor);
}

void drawToolbar(ApplicationState& state, PhysicsWorld& physics) {
    const int panelX = viewportWidth();
    const int panelWidth = GetScreenWidth() - panelX;
    const Vector2 mouse = GetMousePosition();

    DrawRectangle(panelX, TopBarHeight, panelWidth, GetScreenHeight() - TopBarHeight, ColorPanel);
    DrawLine(panelX, TopBarHeight, panelX, GetScreenHeight(), ColorLine);

    DrawText("CONTROL DECK", panelX + 20, 82, 9, ColorPurple);
    DrawText("Toolbar", panelX + 20, 101, 28, ColorText);
    DrawText("01 / 04", panelX + panelWidth - 72, 113, 9, ColorMuted);
    DrawLine(panelX + 18, 143, panelX + panelWidth - 18, 143, ColorLine);

    DrawText("01   TOOLS", panelX + 20, 164, 9, ColorMuted);
    const int left = panelX + 18;
    const int right = panelX + panelWidth / 2 + 3;
    constexpr int buttonWidth = 126;
    constexpr int buttonHeight = 42;

    if (drawButton({static_cast<float>(left), 190.0f, static_cast<float>(buttonWidth), static_cast<float>(buttonHeight)}, "Select", state.tool == Tool::Select, mouse)) {
        state.tool = Tool::Select;
        state.status = "Select tool active";
    }
    if (drawButton({static_cast<float>(right), 190.0f, static_cast<float>(buttonWidth), static_cast<float>(buttonHeight)}, "Move", state.tool == Tool::Move, mouse)) {
        state.tool = Tool::Move;
        state.status = "Move tool active";
    }
    if (drawButton({static_cast<float>(left), 239.0f, static_cast<float>(buttonWidth), static_cast<float>(buttonHeight)}, "Place box", state.tool == Tool::PlaceBox, mouse)) {
        state.tool = Tool::PlaceBox;
        state.status = "Click the ground to place a box";
    }
    if (drawButton({static_cast<float>(right), 239.0f, static_cast<float>(buttonWidth), static_cast<float>(buttonHeight)}, "Place sphere", state.tool == Tool::PlaceSphere, mouse)) {
        state.tool = Tool::PlaceSphere;
        state.status = "Click the ground to place a sphere";
    }

    DrawLine(panelX + 18, 302, panelX + panelWidth - 18, 302, ColorLine);
    DrawText("02   OBJECT ACTIONS", panelX + 20, 322, 9, ColorMuted);

    const bool hasSelection = findBody(physics, state.selectedBody) != nullptr;
    if (drawButton({static_cast<float>(left), 348.0f, static_cast<float>(panelWidth - 36), 40.0f}, "Delete selected object", false, mouse)) {
        if (hasSelection && physics.removeBody(state.selectedBody)) {
            state.selectedBody = 0;
            state.status = "Selected object removed";
        } else {
            state.status = "Select an object first";
        }
    }

    DrawLine(panelX + 18, 404, panelX + panelWidth - 18, 404, ColorLine);
    DrawText("03   SIMULATION", panelX + 20, 424, 9, ColorMuted);
    if (drawButton({static_cast<float>(left), 450.0f, static_cast<float>(panelWidth - 36), 40.0f}, state.paused ? "Resume simulation" : "Pause simulation", false, mouse)) {
        state.paused = !state.paused;
        state.status = state.paused ? "Simulation paused" : "Simulation resumed";
    }
    if (drawButton({static_cast<float>(left), 498.0f, static_cast<float>(panelWidth - 36), 40.0f}, "Reset starter scene", false, mouse)) {
        physics.resetSandbox();
        state.selectedBody = 0;
        state.status = "Starter scene restored";
    }

    DrawLine(panelX + 18, 554, panelX + panelWidth - 18, 554, ColorLine);
    DrawText("SCENE", panelX + 20, 574, 9, ColorMuted);
    DrawText(TextFormat("%i dynamic objects", static_cast<int>(physics.bodyCount())), panelX + 20, 593, 14, ColorText);
    DrawText("JOLT / MULTITHREADED CPU", panelX + 20, 617, 8, ColorGreen);
    DrawText("RENDER / GPU ACCELERATED", panelX + 20, 633, 8, ColorMuted);

    DrawLine(panelX + 18, GetScreenHeight() - 105, panelX + panelWidth - 18, GetScreenHeight() - 105, ColorLine);
    DrawText("CONTROLS", panelX + 20, GetScreenHeight() - 88, 8, ColorPurple);
    DrawText("Right mouse  -  orbit camera", panelX + 20, GetScreenHeight() - 68, 9, ColorMuted);
    DrawText("Wheel  -  zoom     |     Del  -  remove", panelX + 20, GetScreenHeight() - 50, 9, ColorMuted);
    DrawText("FL3 / NATIVE PLAYABLE SLICE", panelX + 20, GetScreenHeight() - 24, 7, Color{82, 80, 112, 255});
}

void drawViewportStatus(const ApplicationState& state) {
    const int width = viewportWidth();
    DrawRectangle(14, TopBarHeight + 13, 184, 25, Color{8, 8, 18, 210});
    DrawRectangleLines(14, TopBarHeight + 13, 184, 25, ColorLine);
    DrawCircle(26, TopBarHeight + 25, 3, state.paused ? Color{203, 174, 119, 255} : ColorGreen);
    DrawText(state.paused ? "PAUSED" : "LIVE PHYSICS", 37, TopBarHeight + 20, 8, ColorText);

    DrawRectangle(14, GetScreenHeight() - 43, width - 28, 28, Color{8, 8, 18, 210});
    DrawRectangleLines(14, GetScreenHeight() - 43, width - 28, 28, ColorLine);
    DrawText(state.status.c_str(), 25, GetScreenHeight() - 35, 9, ColorMuted);
    DrawText("GRID / ON", width - 105, GetScreenHeight() - 35, 8, Color{117, 115, 164, 255});
}

void drawMenu(ApplicationState& state) {
    const int width = GetScreenWidth();
    const int height = GetScreenHeight();
    DrawRectangle(0, 0, width, height, ColorBlack);
    DrawRectangle(width / 2, 0, width / 2, height, ColorWorkspace);

    // Minimal technical-line illustration for the menu's right-hand showcase.
    for (int i = 0; i < 10; ++i) {
        const int y = 180 + i * 45;
        DrawLine(width / 2 + 35, y, width - 45, y, Color{34, 34, 69, 255});
    }
    for (int i = 0; i < 12; ++i) {
        const int x = width / 2 + 40 + i * 52;
        DrawLine(x, 135, x, height - 90, Color{34, 34, 69, 255});
    }
    DrawLine(width / 2 + 120, 550, width / 2 + 330, 420, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 330, 420, width / 2 + 540, 550, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 120, 550, width / 2 + 540, 550, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 120, 430, width / 2 + 330, 300, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 330, 300, width / 2 + 540, 430, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 120, 430, width / 2 + 540, 430, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 120, 430, width / 2 + 120, 550, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 330, 300, width / 2 + 330, 550, Color{133, 130, 210, 255});
    DrawLine(width / 2 + 540, 430, width / 2 + 540, 550, Color{133, 130, 210, 255});

    drawBrand(56, 48);
    DrawText("ACIDIC PRODUCTIONS", 96, 48, 9, ColorMuted);
    DrawText("FRAMELABS", 56, 225, 17, ColorPurple);
    DrawText("3", 160, 225, 17, ColorLilac);
    DrawText("BUILD. EXPERIMENT. DISCOVER.", 56, 270, 10, ColorMuted);
    DrawText("A new space for", 56, 325, 22, ColorMuted);
    DrawText("physical experiments.", 56, 357, 22, ColorText);
    DrawText("NATIVE DESKTOP / EARLY PLAYABLE BUILD", 56, 404, 8, ColorPurple);

    const int buttonX = 56;
    const int buttonWidth = std::min(330, width / 3);
    const Vector2 mouse = GetMousePosition();
    if (drawButton({static_cast<float>(buttonX), 472.0f, static_cast<float>(buttonWidth), 52.0f}, "Start sandbox", true, mouse)) {
        state.screen = Screen::Workspace;
        state.status = "Sandbox started";
    }
    if (drawButton({static_cast<float>(buttonX), 536.0f, static_cast<float>(buttonWidth), 48.0f}, "Settings", false, mouse)) {
        state.screen = Screen::Settings;
    }
    if (drawButton({static_cast<float>(buttonX), 596.0f, static_cast<float>(buttonWidth), 48.0f}, "Exit", false, mouse)) {
        CloseWindow();
    }

    DrawText("FRAME LABS / 003", 56, height - 47, 8, ColorMuted);
    DrawText("UI + PHYSICS FOUNDATION", width - 230, height - 47, 8, ColorMuted);
}

void drawSettings(ApplicationState& state) {
    const int width = GetScreenWidth();
    const int height = GetScreenHeight();
    DrawRectangle(0, 0, width, height, ColorWorkspace);
    DrawRectangle(0, 0, width, TopBarHeight, ColorBlack);
    DrawLine(0, TopBarHeight, width, TopBarHeight, ColorLine);

    drawBrand(25, 15);
    DrawText("FRAMELABS 3", 65, 20, 12, ColorLilac);
    DrawText("SETTINGS", 60, 125, 34, ColorText);
    DrawText("DISPLAY / APPLICATION", 60, 171, 9, ColorPurple);
    DrawText("Frame limit", 60, 230, 15, ColorText);
    DrawText("Choose a frame cap for the native viewport.", 60, 257, 10, ColorMuted);

    const Vector2 mouse = GetMousePosition();
    if (drawButton({60, 295, 130, 42}, "60 FPS", state.frameLimit == 60, mouse)) {
        state.frameLimit = 60;
        SetTargetFPS(60);
    }
    if (drawButton({202, 295, 130, 42}, "120 FPS", state.frameLimit == 120, mouse)) {
        state.frameLimit = 120;
        SetTargetFPS(120);
    }
    if (drawButton({344, 295, 150, 42}, "Unlimited", state.frameLimit == 0, mouse)) {
        state.frameLimit = 0;
        SetTargetFPS(0);
    }

    DrawText("INPUT", 60, 390, 9, ColorPurple);
    DrawText("Right mouse drag    Orbit camera", 60, 420, 12, ColorText);
    DrawText("Mouse wheel         Zoom camera", 60, 447, 12, ColorText);
    DrawText("1 / 2 / 3 / 4       Select tools", 60, 474, 12, ColorText);
    DrawText("Space               Pause / resume", 60, 501, 12, ColorText);
    DrawText("Delete              Remove selected", 60, 528, 12, ColorText);
    DrawText("R                   Reset starter scene", 60, 555, 12, ColorText);

    DrawText("Hardware settings will appear when their native backends are implemented.", 60, height - 105, 10, ColorMuted);
    if (drawButton({60, static_cast<float>(height - 70), 170, 42}, "Back to menu", true, mouse)) {
        state.screen = Screen::Menu;
    }
}

void processWorkspaceInput(ApplicationState& state, PhysicsWorld& physics, const Camera3D& camera) {
    const Vector2 mouse = GetMousePosition();
    const bool inViewport = mouseInsideViewport(mouse);

    if (IsKeyPressed(KEY_ONE)) state.tool = Tool::Select;
    if (IsKeyPressed(KEY_TWO)) state.tool = Tool::Move;
    if (IsKeyPressed(KEY_THREE)) state.tool = Tool::PlaceBox;
    if (IsKeyPressed(KEY_FOUR)) state.tool = Tool::PlaceSphere;

    if (IsKeyPressed(KEY_SPACE)) {
        state.paused = !state.paused;
        state.status = state.paused ? "Simulation paused" : "Simulation resumed";
    }

    if (IsKeyPressed(KEY_R)) {
        physics.resetSandbox();
        state.selectedBody = 0;
        state.draggingBody = false;
        state.status = "Starter scene restored";
    }

    if (IsKeyPressed(KEY_DELETE) || IsKeyPressed(KEY_BACKSPACE)) {
        if (physics.removeBody(state.selectedBody)) {
            state.selectedBody = 0;
            state.status = "Selected object removed";
        }
    }

    if (inViewport && IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        if (state.tool == Tool::Select) {
            state.selectedBody = pickBody(physics, camera, mouse);
            state.status = state.selectedBody != 0 ? "Object selected" : "Nothing selected";
        } else if (state.tool == Tool::Move) {
            state.selectedBody = pickBody(physics, camera, mouse);
            state.draggingBody = state.selectedBody != 0;
            state.status = state.draggingBody ? "Drag to reposition the selected object" : "Select an object to move";
        } else {
            const Ray ray = makeMouseRay(camera);
            Vector3 groundPoint{};
            if (intersectHorizontalPlane(ray, 0.0f, groundPoint)) {
                if (state.tool == Tool::PlaceBox) {
                    state.selectedBody = physics.addBox(
                        {groundPoint.x, 0.62f, groundPoint.z},
                        {0.5f, 0.5f, 0.5f},
                        {125, 122, 205, 255}
                    );
                    state.status = "Box placed - gravity and collisions are active";
                } else if (state.tool == Tool::PlaceSphere) {
                    state.selectedBody = physics.addSphere(
                        {groundPoint.x, 0.62f, groundPoint.z},
                        0.58f,
                        {196, 162, 112, 255}
                    );
                    state.status = "Sphere placed - gravity and collisions are active";
                }
            }
        }
    }

    if (state.tool == Tool::Move && state.draggingBody && IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
        Vec3f currentPosition{};
        if (physics.getBodyPosition(state.selectedBody, currentPosition)) {
            const Ray ray = makeMouseRay(camera);
            Vector3 groundPoint{};
            if (intersectHorizontalPlane(ray, currentPosition.y, groundPoint)) {
                physics.setBodyPosition(
                    state.selectedBody,
                    {groundPoint.x, currentPosition.y, groundPoint.z}
                );
            }
        } else {
            state.draggingBody = false;
            state.selectedBody = 0;
        }
    }

    if (IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        state.draggingBody = false;
    }
}

} // namespace

int main() {
    SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT);
    InitWindow(InitialWidth, InitialHeight, "FrameLabs 3 - Native Sandbox");
    if (!IsWindowReady()) {
        return 1;
    }

    SetWindowMinSize(960, 640);
    SetTargetFPS(120);
    SetExitKey(KEY_NULL);

    PhysicsWorld physics;
    Model cubeModel = LoadModelFromMesh(GenMeshCube(1.0f, 1.0f, 1.0f));

    ApplicationState state;
    while (!WindowShouldClose()) {
        const float frameDelta = GetFrameTime();
        updateCamera(state.orbit);
        const Camera3D camera = makeCamera(state.orbit);

        if (state.screen == Screen::Workspace) {
            processWorkspaceInput(state, physics, camera);
            if (!state.paused) {
                physics.step(frameDelta);
            }
        }

        BeginDrawing();
        ClearBackground(ColorBlack);

        if (state.screen == Screen::Menu) {
            drawMenu(state);
        } else if (state.screen == Screen::Settings) {
            drawSettings(state);
        } else {
            drawWorld(physics, camera, cubeModel, state.selectedBody);
            drawTopBar(state);
            drawViewportStatus(state);
            drawToolbar(state, physics);
            DrawFPS(12, 12);
        }

        EndDrawing();
    }

    UnloadModel(cubeModel);
    CloseWindow();
    return 0;
}
