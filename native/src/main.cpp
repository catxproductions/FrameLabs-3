#include "framelabs/StructuralWorld.hpp"
#include <raylib.h>
#ifdef _WIN32
#include <windows.h>
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
enum class Tool{Select,Node,Member,Load,Heat};
struct App{
 Screen screen=Screen::Menu; Tool tool=Tool::Select; MaterialKind material=MaterialKind::Steel;
 bool paused=false,stress=true; float zoom=1; Vector2 pan{0,0};
 NodeId firstNode=0,selectedNode=0; MemberId selectedMember=0; std::string status="Ready — build a structure";
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
 for(const auto&m:w.members()){
  Color c=m.broken?Color{105,94,111,255}:(a.stress?stressColor(m.stressRatio):materialColor(m.material));
  if(m.yielding&&!m.broken)c=Color{245,156,91,255};
  for(const auto&s:m.segments){Vector2 center=worldToScreen(s.center,a);float len=s.length*step,thick=std::max(3.0f,s.thickness*step);
   DrawRectanglePro({center.x,center.y,len,thick},{len/2,thick/2},-s.angleRadians*RAD2DEG,c);
  }
  if(m.id==a.selectedMember){DrawCircleV(worldToScreen(m.start,a),10,Lilac);DrawCircleV(worldToScreen(m.end,a),10,Lilac);}
 }
 for(const auto&l:w.loads()){Vector2 p=worldToScreen(l.position,a);DrawCircleV(p,l.radius*step,Color{236,173,99,255});DrawCircleLines((int)p.x,(int)p.y,(int)(l.radius*step),Text);DrawText(TextFormat("%.0f kg",l.massKg),(int)p.x+18,(int)p.y-8,10,Text);}
 for(const auto&n:w.nodes()){Vector2 p=worldToScreen(n.position,a);Color c=n.pinned?Color{244,192,105,255}:Color{210,208,242,255};DrawCircleV(p,n.id==a.selectedNode?10:6,c);DrawCircleLines((int)p.x,(int)p.y,n.id==a.selectedNode?14:9,Color{30,29,54,255});}
 if(a.firstNode)for(const auto&n:w.nodes())if(n.id==a.firstNode){Vector2 p=worldToScreen(n.position,a);DrawCircleLines((int)p.x,(int)p.y,17,Purple);}
 EndScissorMode();
 DrawRectangle(14,Top+14,205,28,Color{8,8,18,230});DrawRectangleLines(14,Top+14,205,28,Line);DrawCircle(28,Top+28,4,a.paused?Color{237,173,99,255}:Color{105,196,157,255});DrawText(a.paused?"SIMULATION PAUSED":"LIVE STRUCTURAL PHYSICS",40,Top+22,9,Text);
 DrawRectangle(14,GetScreenHeight()-42,vw-28,27,Color{8,8,18,220});DrawRectangleLines(14,GetScreenHeight()-42,vw-28,27,Line);DrawText(a.status.c_str(),25,GetScreenHeight()-34,9,Muted);
}
void drawSidebar(StructuralWorld&w,App&a){
 int x=GetScreenWidth()-Side;DrawRectangle(x,Top,Side,GetScreenHeight()-Top,Panel);DrawLine(x,Top,x,GetScreenHeight(),Line);
 DrawText("STRUCTURAL LAB",x+20,80,9,Purple);DrawText("Toolbox",x+20,101,26,Text);DrawLine(x+18,140,x+Side-18,140,Line);DrawText("TOOLS",x+20,158,9,Muted);
 const char* names[]={"Select","Add node","Connect members","Add load","Heat brush"};Tool tools[]={Tool::Select,Tool::Node,Tool::Member,Tool::Load,Tool::Heat};
 for(int i=0;i<5;i++)if(button({(float)x+18,180.0f+i*43,Side-36.0f,36},names[i],a.tool==tools[i])){a.tool=tools[i];a.firstNode=0;a.status=std::string(names[i])+" selected";}
 DrawLine(x+18,408,x+Side-18,408,Line);DrawText("MATERIAL",x+20,426,9,Muted);
 MaterialKind mats[]={MaterialKind::Steel,MaterialKind::Wood,MaterialKind::Composite,MaterialKind::Concrete};
 for(int i=0;i<4;i++){float bx=x+18+(i%2)*130,by=450+(i/2)*42;if(button({bx,by,122,34},materialName(mats[i]),a.material==mats[i]))a.material=mats[i];}
 DrawLine(x+18,540,x+Side-18,540,Line);DrawText("SIMULATION",x+20,558,9,Muted);
 if(button({(float)x+18,580,Side-36.0f,38},a.paused?"Resume":"Pause"))a.paused=!a.paused;
 if(button({(float)x+18,625,Side-36.0f,38},"Reset experiment")){w.resetDemo();a.selectedNode=0;a.selectedMember=0;a.firstNode=0;}
 if(button({(float)x+18,670,Side-36.0f,38},a.stress?"Stress overlay: ON":"Stress overlay: OFF"))a.stress=!a.stress;
 DrawLine(x+18,725,x+Side-18,725,Line);
 DrawText(TextFormat("%i nodes  /  %i members",(int)w.nodeCount(),(int)w.memberCount()),x+20,746,11,Text);
 DrawText(TextFormat("%i failed members",(int)w.brokenMemberCount()),x+20,768,10,Color{232,143,116,255});
 DrawText("MATERIAL RESPONSE / GAME UNITS",x+20,GetScreenHeight()-44,8,Muted);
}
void input(StructuralWorld&w,App&a){
 Vector2 mouse=GetMousePosition();if(mouse.x>GetScreenWidth()-Side||mouse.y<Top)return;
 if(IsKeyPressed(KEY_SPACE))a.paused=!a.paused;if(IsKeyPressed(KEY_R)){w.resetDemo();a.firstNode=0;}
 if(IsKeyPressed(KEY_ONE))a.tool=Tool::Select;if(IsKeyPressed(KEY_TWO))a.tool=Tool::Node;
 if(IsKeyPressed(KEY_THREE))a.tool=Tool::Member;if(IsKeyPressed(KEY_FOUR))a.tool=Tool::Load;if(IsKeyPressed(KEY_FIVE))a.tool=Tool::Heat;
 if(IsMouseButtonDown(MOUSE_BUTTON_MIDDLE)){Vector2 d=GetMouseDelta();a.pan.x+=d.x;a.pan.y+=d.y;}
 float wheel=GetMouseWheelMove();if(wheel!=0&&inView(mouse))a.zoom=clampf(a.zoom+wheel*.08f,.45f,2.4f);
 if(a.tool==Tool::Heat&&IsMouseButtonDown(MOUSE_BUTTON_LEFT)&&inView(mouse)){w.applyHeat(screenToWorld(mouse,a),1.7f,520,GetFrameTime());return;}
 if(IsMouseButtonPressed(MOUSE_BUTTON_RIGHT)&&inView(mouse)){NodeId n=w.findNodeNear(screenToWorld(mouse,a),.28f);if(n)w.toggleNodePin(n);return;}
 if(!IsMouseButtonPressed(MOUSE_BUTTON_LEFT)||!inView(mouse))return;
 Vec2 p=screenToWorld(mouse,a);
 if(a.tool==Tool::Node){a.selectedNode=w.addNode(p,false);a.status="Node added";return;}
 if(a.tool==Tool::Member){NodeId n=w.findNodeNear(p,.35f);if(!n){a.status="Connect members by clicking two nodes";return;}if(!a.firstNode){a.firstNode=n;a.status="First node selected — choose the second";return;}MemberId id=w.addMember(a.firstNode,n,a.material);a.firstNode=0;a.selectedMember=id;a.status=id?"Structural member connected":"Could not connect those nodes";return;}
 if(a.tool==Tool::Load){w.addLoad(p,220);a.status="220 kg test load added";return;}
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
