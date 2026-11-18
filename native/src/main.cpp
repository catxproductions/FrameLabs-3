#include "framelabs/StructuralWorld.hpp"
#include <raylib.h>
#ifdef _WIN32
// Keep Win32 API names from colliding with raylib's public API and types.
#define CloseWindow Win32ApiCloseWindow
#define ShowCursor Win32ApiShowCursor
#define Rectangle Win32GdiRectangle
#include <windows.h>
#undef CloseWindow
#undef ShowCursor
#undef Rectangle
#undef DrawText
#endif
#include <algorithm>
#include <cmath>
#include <string>

namespace {
using namespace framelabs;
constexpr int W=1600,H=900,Top=58,Side=300;
const Color BG{8,8,17,255},Panel{12,12,25,255},Panel2{20,20,39,255},Line{55,53,86,255};
const Color Purple{125,121,207,255},Lilac{197,193,248,255},Text{229,226,250,255},Muted{139,136,171,255};
enum class Screen{Menu,Game,Settings};
enum class Tool{Select,Node,Member,Rope,Load,Heat,Explode,Ignite,Ladder,Stairs,Elevator};
struct App{
 Screen screen=Screen::Menu; Tool tool=Tool::Select; MaterialKind material=MaterialKind::Steel;
 bool paused=false,stress=true; float zoom=1; Vector2 pan{0,0};
 NodeId firstNode=0,selectedNode=0; MemberId selectedMember=0;
 bool hasFirstConnectorPoint=false; Vec2 firstConnectorPoint{};
 std::string status="Ready — build a structure";
};
float clampf(float x,float a,float b){return std::max(a,std::min(b,x));}
Color materialColor(MaterialKind m){auto c=materialProfile(m).color;return {c.r,c.g,c.b,255};}
const char* materialName(MaterialKind m){return materialProfile(m).label;}
Color stressColor(float s){
 s=clampf(s,0,1.5f);
 if(s<.5f){float t=s*2;return {static_cast<unsigned char>(80+45*t),static_cast<unsigned char>(185+20*t),static_cast<unsigned char>(205-25*t),255};}
 float t=clampf((s-.5f)/.7f,0,1);return {static_cast<unsigned char>(125+125*t),static_cast<unsigned char>(205-145*t),static_cast<unsigned char>(180-130*t),255};
}
float scale(const App&a){return 68*a.zoom;}
Vector2 worldToScreen(Vec2 p,const App&a){return {105+a.pan.x+p.x*scale(a),GetScreenHeight()-100+a.pan.y-p.y*scale(a)};}
Vec2 screenToWorld(Vector2 p,const App&a){return {(p.x-105-a.pan.x)/scale(a),(GetScreenHeight()-100+a.pan.y-p.y)/scale(a)};}
bool inView(Vector2 p){return p.x>0&&p.x<GetScreenWidth()-Side&&p.y>Top&&p.y<GetScreenHeight()-48;}
bool button(Rectangle r,const char*label,bool active=false){
 Vector2 m=GetMousePosition();bool over=CheckCollisionPointRec(m,r);
 DrawRectangleRounded(r,.12f,6,active?Color{53,50,102,255}:over?Color{35,33,61,255}:Panel2);
 DrawRectangleRoundedLines(r,.12f,6,active?Purple:Line);
 DrawText(label,(int)r.x+12,(int)(r.y+r.height/2-7),13,active?Text:Muted);
 return over&&IsMouseButtonReleased(MOUSE_BUTTON_LEFT);
}
void brand(){DrawRectangleLines(18,15,27,27,Purple);DrawRectangle(24,30,4,7,Purple);DrawRectangle(30,24,4,13,Purple);DrawRectangle(36,19,4,18,Lilac);DrawText("FRAMELABS",58,17,16,Lilac);DrawText("3",148,17,16,Purple);DrawText("STRUCTURAL LAB",181,22,9,Muted);}
void drawMenu(App&a){
 DrawRectangle(0,0,GetScreenWidth(),GetScreenHeight(),BG);DrawRectangle(GetScreenWidth()/2,0,GetScreenWidth()/2,GetScreenHeight(),Color{17,17,37,255});brand();
 DrawText("THE NEXT GENERATION OF",70,220,12,Purple);DrawText("STRUCTURAL",70,270,44,Text);DrawText("PHYSICS.",70,322,44,Lilac);
 DrawText("Build structures. Apply loads. Watch stress travel,",72,400,16,Muted);DrawText("materials bend, and structural failures unfold.",72,427,16,Muted);
 Vector2 pts[]={{850,650},{850,490},{1030,390},{1210,490},{1210,650},{850,650}};
 for(int i=0;i<5;i++)DrawLineEx(pts[i],pts[i+1],8,Color{112,108,190,255});
 DrawLineEx({850,490},{1030,560},6,Color{112,108,190,255});DrawLineEx({1030,560},{1210,490},6,Color{112,108,190,255});
 for(auto p:pts)DrawCircleV(p,7,Lilac);
 DrawText("FL / 03     STRUCTURAL SIMULATION",850,720,10,Muted);
 if(button({70,510,330,54},"ENTER STRUCTURAL LAB",true))a.screen=Screen::Game;
 if(button({70,580,330,48},"SETTINGS"))a.screen=Screen::Settings;
 DrawText("ACIDIC PRODUCTIONS   /   EARLY ACCESS",70,GetScreenHeight()-48,9,Muted);
}
void drawSettings(App&a){
 DrawRectangle(0,0,GetScreenWidth(),GetScreenHeight(),BG);brand();DrawText("SETTINGS",70,150,34,Text);DrawText("DISPLAY",70,215,10,Purple);DrawText("Zoom",70,255,15,Text);
 if(button({70,290,110,42},"−"))a.zoom=clampf(a.zoom-.1f,.5f,2.0f);
 if(button({190,290,110,42},"+"))a.zoom=clampf(a.zoom+.1f,.5f,2.0f);
 DrawText(TextFormat("%.0f%%",a.zoom*100),330,304,14,Muted);
 if(button({70,390,180,45},"BACK",true))a.screen=Screen::Menu;
}
void drawWorld(const StructuralWorld&w,App&a){
 const int vw=GetScreenWidth()-Side;BeginScissorMode(0,Top,vw,GetScreenHeight()-Top);
 DrawRectangle(0,Top,vw,GetScreenHeight()-Top,Color{17,17,36,255});
 const float step=scale(a);
 for(float x=std::fmod(105+a.pan.x,step);x<vw;x+=step)DrawLine((int)x,Top,(int)x,GetScreenHeight(),Color{34,33,62,255});
 for(float y=std::fmod(GetScreenHeight()-100+a.pan.y,step);y<GetScreenHeight();y+=step)DrawLine(0,(int)y,vw,(int)y,Color{34,33,62,255});
 Vector2 groundA=worldToScreen({0,0},a),groundB=worldToScreen({40,0},a);DrawLineEx(groundA,groundB,3,Color{100,98,145,255});
 for(const auto& connector:w.connectors()){
  const Vector2 p0=worldToScreen(connector.a,a),p1=worldToScreen(connector.b,a);
  const Color color=connector.falling?Color{235,164,118,255}:
   connector.kind==ConnectorKind::Elevator?Color{113,201,205,255}:
   connector.kind==ConnectorKind::Stairs?Color{174,166,224,255}:Color{213,185,137,255};
  const float width=connector.width*scale(a);
  const float dx=connector.b.x-connector.a.x,dy=connector.b.y-connector.a.y;
  const float span=std::max(0.001f,std::hypot(dx,dy));
  const float nx=-dy/span,ny=dx/span;
  if(connector.kind==ConnectorKind::Elevator){
   const float ox=nx*connector.width*.5f,oy=ny*connector.width*.5f;
   DrawLineEx(worldToScreen({connector.a.x+ox,connector.a.y+oy},a),
    worldToScreen({connector.b.x+ox,connector.b.y+oy},a),std::max(2.0f,width*.12f),color);
   DrawLineEx(worldToScreen({connector.a.x-ox,connector.a.y-oy},a),
    worldToScreen({connector.b.x-ox,connector.b.y-oy},a),std::max(2.0f,width*.12f),color);
   const Vector2 center=worldToScreen(
    {(connector.a.x+connector.b.x)*.5f,(connector.a.y+connector.b.y)*.5f},a);
   const Rectangle cabin{center.x,center.y,width*.72f,width*.72f};
   const Vector2 origin{width*.36f,width*.36f};
   DrawRectanglePro(cabin,origin,-std::atan2(dy,dx)*RAD2DEG,Color{72,153,164,95});
   DrawRectanglePro(cabin,origin,-std::atan2(dy,dx)*RAD2DEG,color);
  }else if(connector.kind==ConnectorKind::Ladder){
   const float ox=connector.width*scale(a)*1.25f;
   DrawLineEx({p0.x-nx*ox,p0.y+ny*ox},{p1.x-nx*ox,p1.y+ny*ox},2.0f,color);
   DrawLineEx({p0.x+nx*ox,p0.y-ny*ox},{p1.x+nx*ox,p1.y-ny*ox},2.0f,color);
   const int rungs=std::max(2,static_cast<int>(span/0.28f));
   for(int i=1;i<rungs;++i){const float t=static_cast<float>(i)/rungs;
    const Vector2 center{p0.x+(p1.x-p0.x)*t,p0.y+(p1.y-p0.y)*t};
    DrawLineEx({center.x-nx*ox,center.y+ny*ox},{center.x+nx*ox,center.y-ny*ox},2.0f,color);
   }
  }else{
   DrawLineEx(p0,p1,std::max(3.0f,width*.22f),color);
   const int steps=std::max(3,static_cast<int>(span/0.24f));
   for(int i=1;i<steps;++i){const float t=static_cast<float>(i)/steps;
    const Vector2 center{p0.x+(p1.x-p0.x)*t,p0.y+(p1.y-p0.y)*t};
    DrawLineEx({center.x-nx*width*.32f,center.y+ny*width*.32f},
     {center.x+nx*width*.32f,center.y-ny*width*.32f},3.0f,color);
   }
  }
  DrawCircleV(p0,3.0f,color);DrawCircleV(p1,3.0f,color);
 }
 if(a.hasFirstConnectorPoint){const Vector2 mark=worldToScreen(a.firstConnectorPoint,a);DrawCircleLines((int)mark.x,(int)mark.y,10,Purple);}
 for(const auto&m:w.members()){
  Color c=m.broken?Color{105,94,111,255}:(a.stress?stressColor(m.stressRatio):materialColor(m.material));
  if(m.yielding&&!m.broken)c=Color{245,156,91,255};
  if(m.ignited&&!m.broken)c=Color{255,126,54,255};
  for(const auto&s:m.segments){
   Vector2 center=worldToScreen(s.center,a);
   float len=s.length*step,thick=std::max(3.0f,s.thickness*step);
   if(m.role==MemberRole::Rope){
    const Vector2 direction{std::cos(s.angleRadians),std::sin(s.angleRadians)};
    const Vec2 worldA{s.center.x-direction.x*s.length*.5f,s.center.y-direction.y*s.length*.5f};
    const Vec2 worldB{s.center.x+direction.x*s.length*.5f,s.center.y+direction.y*s.length*.5f};
    DrawLineEx(worldToScreen(worldA,a),worldToScreen(worldB,a),std::max(2.0f,thick*.45f),c);
   }else{
    DrawRectanglePro({center.x,center.y,len,thick},{len/2,thick/2},-s.angleRadians*RAD2DEG,c);
   }
  }
  if(m.id==a.selectedMember){DrawCircleV(worldToScreen(m.start,a),10,Lilac);DrawCircleV(worldToScreen(m.end,a),10,Lilac);}
 }
 for(const auto&l:w.loads()){Vector2 p=worldToScreen(l.position,a);DrawCircleV(p,l.radius*step,Color{236,173,99,255});DrawCircleLines((int)p.x,(int)p.y,(int)(l.radius*step),Text);DrawText(TextFormat("%.0f kg",l.massKg),(int)p.x+18,(int)p.y-8,10,Text);}
 for(const auto&n:w.nodes()){Vector2 p=worldToScreen(n.position,a);Color c=n.pinned?Color{244,192,105,255}:Color{210,208,242,255};DrawCircleV(p,n.id==a.selectedNode?10:6,c);DrawCircleLines((int)p.x,(int)p.y,n.id==a.selectedNode?14:9,Color{30,29,54,255});}
 if(a.firstNode)for(const auto&n:w.nodes())if(n.id==a.firstNode){Vector2 p=worldToScreen(n.position,a);DrawCircleLines((int)p.x,(int)p.y,17,Purple);}
 EndScissorMode();
 DrawRectangle(14,Top+14,205,28,Color{8,8,18,230});DrawRectangleLines(14,Top+14,205,28,Line);DrawCircle(28,Top+28,4,a.paused?Color{237,173,99,255}:Color{105,196,157,255});DrawText(a.paused?"SIMULATION PAUSED":"LIVE STRUCTURAL PHYSICS",40,Top+22,9,Text);
 DrawText("GRID SCALE: 25 FT × 25 FT / CELL",235,Top+23,9,Muted);
 DrawRectangle(14,GetScreenHeight()-42,vw-28,27,Color{8,8,18,220});DrawRectangleLines(14,GetScreenHeight()-42,vw-28,27,Line);DrawText(a.status.c_str(),25,GetScreenHeight()-34,9,Muted);
}
void drawSidebar(StructuralWorld&w,App&a){
 const int x=GetScreenWidth()-Side,height=GetScreenHeight();
 const bool compact=height<850;
 DrawRectangle(x,Top,Side,height-Top,Panel);DrawLine(x,Top,x,height,Line);
 DrawText("STRUCTURAL LAB",x+20,80,9,Purple);DrawText("Toolbox",x+20,101,26,Text);DrawLine(x+18,140,x+Side-18,140,Line);DrawText("TOOLS",x+20,158,9,Muted);
 const char* names[]={"Select","Add node","Connect","Rope","Add load","Heat","Explode","Ignite","Ladder","Stairs","Elevator"};
 Tool tools[]={Tool::Select,Tool::Node,Tool::Member,Tool::Rope,Tool::Load,Tool::Heat,Tool::Explode,Tool::Ignite,Tool::Ladder,Tool::Stairs,Tool::Elevator};
 const float toolStart=compact?160.0f:180.0f,toolStep=compact?31.0f:37.0f,toolHeight=compact?27.0f:32.0f;
 const float toolWidth=(Side-48.0f)/2.0f;
 for(int i=0;i<11;i++){
  const float bx=static_cast<float>(x+18)+(i%2)*(toolWidth+12.0f);
  const float by=toolStart+(i/2)*toolStep;
  if(button({bx,by,toolWidth,toolHeight},names[i],a.tool==tools[i])){
   a.tool=tools[i];a.firstNode=0;a.hasFirstConnectorPoint=false;a.status=std::string(names[i])+" selected";
  }
 }
 const float materialLine=compact?382.0f:445.0f,materialTitle=compact?395.0f:461.0f,materialStart=compact?414.0f:482.0f,materialStep=compact?30.0f:35.0f,materialHeight=compact?25.0f:28.0f;
 DrawLine(x+18,materialLine,x+Side-18,materialLine,Line);DrawText("MATERIAL",x+20,(int)materialTitle,9,Muted);
 MaterialKind mats[]={MaterialKind::Steel,MaterialKind::Wood,MaterialKind::ExplosiveComposite,MaterialKind::FlammableComposite,MaterialKind::Concrete};
 for(int i=0;i<5;i++){float bx=x+18+(i%2)*130,by=materialStart+(i/2)*materialStep;if(button({bx,by,122,materialHeight},materialName(mats[i]),a.material==mats[i]))a.material=mats[i];}
 const float simulationLine=compact?508.0f:590.0f,simulationTitle=compact?521.0f:606.0f,simulationStart=compact?540.0f:625.0f,simulationStep=compact?26.0f:31.0f,simulationHeight=compact?23.0f:26.0f;
 DrawLine(x+18,simulationLine,x+Side-18,simulationLine,Line);DrawText("SIMULATION",x+20,(int)simulationTitle,9,Muted);
 if(button({(float)x+18,simulationStart,Side-36.0f,simulationHeight},a.paused?"Resume":"Pause"))a.paused=!a.paused;
 if(button({(float)x+18,simulationStart+simulationStep,Side-36.0f,simulationHeight},"Reset experiment")){w.resetDemo();a.selectedNode=0;a.selectedMember=0;a.firstNode=0;}
 if(button({(float)x+18,simulationStart+2*simulationStep,Side-36.0f,simulationHeight},a.stress?"Stress overlay: ON":"Stress overlay: OFF"))a.stress=!a.stress;
 DrawLine(x+18,compact?620:725,x+Side-18,compact?620:725,Line);
 if(compact){
  DrawText(TextFormat("%i nodes / %i members",(int)w.nodeCount(),(int)w.memberCount()),x+20,height-52,9,Text);
  DrawText(TextFormat("%i failed members",(int)w.brokenMemberCount()),x+20,height-36,8,Color{232,143,116,255});
  DrawText(TextFormat("%i connectors / %i falling  ·  GRID 5 FT²/CELL",
   (int)w.connectorCount(),(int)w.fallingConnectorCount()),x+20,height-17,7,Muted);
 }else{
  DrawText(TextFormat("%i nodes  /  %i members",(int)w.nodeCount(),(int)w.memberCount()),x+20,746,11,Text);
  DrawText(TextFormat("%i failed members",(int)w.brokenMemberCount()),x+20,768,10,Color{232,143,116,255});
  DrawText(TextFormat("%i connectors  /  %i falling",(int)w.connectorCount(),(int)w.fallingConnectorCount()),x+20,785,8,Muted);
  DrawText("GRID SCALE / 5 FT² PER CELL",x+20,height-44,8,Muted);
 }
}
void input(StructuralWorld&w,App&a){
 Vector2 mouse=GetMousePosition();
 // Keyboard commands are global to the active workspace, not the pointer region.
 if(IsKeyPressed(KEY_SPACE))a.paused=!a.paused;
 if(IsKeyPressed(KEY_R)){w.resetDemo();a.firstNode=0;a.selectedNode=0;a.selectedMember=0;a.hasFirstConnectorPoint=false;}
 auto chooseTool=[&](Tool tool){if(a.tool!=tool){a.tool=tool;a.firstNode=0;a.hasFirstConnectorPoint=false;}};
 if(IsKeyPressed(KEY_ONE))chooseTool(Tool::Select);
 if(IsKeyPressed(KEY_TWO))chooseTool(Tool::Node);
 if(IsKeyPressed(KEY_THREE))chooseTool(Tool::Member);
 if(IsKeyPressed(KEY_T))chooseTool(Tool::Rope);
 if(IsKeyPressed(KEY_FOUR))chooseTool(Tool::Load);
 if(IsKeyPressed(KEY_FIVE))chooseTool(Tool::Heat);
 if(IsKeyPressed(KEY_E))chooseTool(Tool::Explode);
 if(IsKeyPressed(KEY_I))chooseTool(Tool::Ignite);
 if(IsKeyPressed(KEY_L))chooseTool(Tool::Ladder);
 if(IsKeyPressed(KEY_S))chooseTool(Tool::Stairs);
 if(IsKeyPressed(KEY_V))chooseTool(Tool::Elevator);
 if(mouse.x>GetScreenWidth()-Side||mouse.y<Top)return;
 if(IsMouseButtonDown(MOUSE_BUTTON_MIDDLE)){Vector2 d=GetMouseDelta();a.pan.x+=d.x;a.pan.y+=d.y;}
 float wheel=GetMouseWheelMove();if(wheel!=0&&inView(mouse))a.zoom=clampf(a.zoom+wheel*.08f,.45f,2.4f);
 if(a.tool==Tool::Heat&&IsMouseButtonDown(MOUSE_BUTTON_LEFT)&&inView(mouse)){w.applyHeat(screenToWorld(mouse,a),1.7f,520,GetFrameTime());return;}
 if(a.tool==Tool::Ignite&&IsMouseButtonDown(MOUSE_BUTTON_LEFT)&&inView(mouse)){w.ignite(screenToWorld(mouse,a),.55f);return;}
 if(IsMouseButtonPressed(MOUSE_BUTTON_RIGHT)&&inView(mouse)){NodeId n=w.findNodeNear(screenToWorld(mouse,a),.28f);if(n)w.toggleNodePin(n);return;}
 if(!IsMouseButtonPressed(MOUSE_BUTTON_LEFT)||!inView(mouse))return;
 Vec2 p=screenToWorld(mouse,a);
 if(a.tool==Tool::Node){a.selectedNode=w.addNode(p,false);a.status="Node added";return;}
 if(a.tool==Tool::Member||a.tool==Tool::Rope){
  NodeId n=w.findNodeNear(p,.35f);
  if(!n){a.status="Connect by clicking two nodes";return;}
  if(!a.firstNode){a.firstNode=n;a.status="First node selected — choose the second";return;}
  const MemberRole role=a.tool==Tool::Rope?MemberRole::Rope:MemberRole::Beam;
  MemberId id=w.addMember(a.firstNode,n,a.material,role);
  a.firstNode=0;a.selectedMember=id;
  a.status=id?(role==MemberRole::Rope?"Flexible rope connected":"Structural member connected"):"Could not connect those nodes";
  return;
 }
 if(a.tool==Tool::Ladder||a.tool==Tool::Stairs||a.tool==Tool::Elevator){
  if(!a.hasFirstConnectorPoint){
   a.firstConnectorPoint=p;a.hasFirstConnectorPoint=true;
   a.status="First landing marked — click the second supported landing";return;
  }
  const ConnectorKind kind=a.tool==Tool::Ladder?ConnectorKind::Ladder:
   a.tool==Tool::Elevator?ConnectorKind::Elevator:ConnectorKind::Stairs;
  const ConnectorId id=w.addConnector(kind,a.firstConnectorPoint,p);
  a.hasFirstConnectorPoint=false;
  a.status=id?"Connector added — it follows its supports and falls if they fail":
   "Landings are too close or invalid";
  return;
 }
 if(a.tool==Tool::Load){w.addLoad(p,220);a.status="220 kg test load added";return;}
 if(a.tool==Tool::Explode){w.explode(p,1.65f,18.0f);a.status="In-game blast triggered";return;}
 if(a.tool==Tool::Ignite){w.ignite(p,.55f);a.status="Ignition applied to flammable composite";return;}
 if(a.tool==Tool::Select){NodeId n=w.findNodeNear(p,.28f);a.selectedNode=n;a.selectedMember=w.findMemberNear(p,.22f);if(!n&&!a.selectedMember){auto load=w.findLoadNear(p,.4f);if(load)w.removeLoad(load);}a.status=n?"Node selected":a.selectedMember?"Member selected":"Selection cleared";}
}
}
int main(){
 SetConfigFlags(FLAG_WINDOW_RESIZABLE|FLAG_MSAA_4X_HINT|FLAG_VSYNC_HINT);InitWindow(W,H,"FrameLabs 3 — Structural Lab");SetWindowMinSize(1024,680);SetTargetFPS(120);
 App app;StructuralWorld world;float accumulator=0;constexpr float fixed=1.0f/120.0f;
 while(!WindowShouldClose()){
  float dt=std::min(GetFrameTime(),.05f);
  if(app.screen==Screen::Game){input(world,app);if(!app.paused){accumulator+=dt;while(accumulator>=fixed){world.step(fixed);accumulator-=fixed;}}}
  BeginDrawing();ClearBackground(BG);
  if(app.screen==Screen::Menu)drawMenu(app);else if(app.screen==Screen::Settings)drawSettings(app);else{
   DrawRectangle(0,0,GetScreenWidth(),Top,BG);DrawLine(0,Top-1,GetScreenWidth(),Top-1,Line);brand();
   DrawText("2D STRUCTURAL SIMULATION",GetScreenWidth()-Side-220,22,9,Muted);drawWorld(world,app);drawSidebar(world,app);
  }
  EndDrawing();
 }
 CloseWindow();return 0;
}
#ifdef _WIN32
int main();
int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) { return main(); }
#endif
