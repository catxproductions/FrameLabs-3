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
#include <vector>
#include <filesystem>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <unordered_map>

namespace {
using namespace framelabs;
constexpr int W=1600,H=900,Top=58,Side=300;
const Color BG{8,8,17,255},Panel{12,12,25,255},Panel2{20,20,39,255},Line{55,53,86,255};
const Color Purple{125,121,207,255},Lilac{197,193,248,255},Text{229,226,250,255},Muted{139,136,171,255};
enum class Screen{Menu,Game,Settings};
enum class Tool{Select,Node,Member,Rope,Load,Heat,Explode,Ignite,Ladder,Stairs,Elevator,QuickBeam,QuickColumn,QuickBrace,Floor,Wall,Break,Delete,Exit};
struct App{
 Screen screen=Screen::Menu; Tool tool=Tool::Select; MaterialKind material=MaterialKind::Steel;
 bool paused=false,stress=true; float zoom=1; Vector2 pan{0,0};
 NodeId firstNode=0,selectedNode=0; MemberId selectedMember=0;
 bool hasFirstConnectorPoint=false; Vec2 firstConnectorPoint{};
 bool quickBuildDragging=false; Vec2 quickBuildStart{},quickBuildEnd{};
 bool namingBuild=false; std::string buildName="My Build";
 std::vector<Vec2> exits;
 std::string status="Ready — build a structure";
};
float clampf(float x,float a,float b){return std::max(a,std::min(b,x));}
std::filesystem::path savedBuildDirectory(){const char* home=std::getenv("USERPROFILE");if(!home)home=std::getenv("HOME");if(!home)home=".";return std::filesystem::path(home)/"Documents"/"FrameLabs 3"/"Saved Builds";}
std::string safeBuildName(std::string name){
 for(char& ch:name){if(ch=='/'||ch=='\\'||ch==':'||ch=='*'||ch=='?'||ch=='"'||ch=='<'||ch=='>'||ch=='|')ch='_';}
 while(!name.empty()&&(name.back()==' '||name.back()=='.'))name.pop_back();
 if(name.empty())name="My Build";if(name.size()>48)name.resize(48);return name;
}
bool saveBuild(const StructuralWorld& world,const App& app){
 try{
  const auto dir=savedBuildDirectory();std::filesystem::create_directories(dir);
  const auto path=dir/(safeBuildName(app.buildName)+".fl3build");std::ofstream out(path,std::ios::trunc);if(!out)return false;
  out<<"FL3BUILD 1\n"<<std::setprecision(9);
  std::unordered_map<NodeId,std::size_t> indices;const auto& nodes=world.nodes();out<<nodes.size()<<'\n';
  for(std::size_t i=0;i<nodes.size();++i){indices[nodes[i].id]=i;out<<nodes[i].position.x<<' '<<nodes[i].position.y<<' '<<(nodes[i].pinned?1:0)<<'\n';}
  std::vector<const MemberView*> members;for(const auto& m:world.members())if(!m.broken)members.push_back(&m);
  out<<members.size()<<'\n';for(const auto* m:members){auto a=indices.find(m->nodeA),b=indices.find(m->nodeB);if(a==indices.end()||b==indices.end())return false;out<<a->second<<' '<<b->second<<' '<<static_cast<int>(m->material)<<' '<<static_cast<int>(m->role)<<'\n';}
  out<<world.loads().size()<<'\n';for(const auto& l:world.loads())out<<l.position.x<<' '<<l.position.y<<' '<<l.massKg<<'\n';
  out<<world.connectors().size()<<'\n';for(const auto& v:world.connectors())out<<static_cast<int>(v.kind)<<' '<<v.a.x<<' '<<v.a.y<<' '<<v.b.x<<' '<<v.b.y<<'\n';
  out<<app.exits.size()<<'\n';for(const auto& e:app.exits)out<<e.x<<' '<<e.y<<'\n';
  return static_cast<bool>(out);
 }catch(...){return false;}
}
bool loadLatestBuild(StructuralWorld& world,App& app){
 try{
  const auto dir=savedBuildDirectory();if(!std::filesystem::exists(dir))return false;
  std::filesystem::path latest;std::filesystem::file_time_type latestTime{};
  for(const auto& entry:std::filesystem::directory_iterator(dir))if(entry.is_regular_file()&&entry.path().extension()==".fl3build"){
   const auto t=entry.last_write_time();if(latest.empty()||t>latestTime){latest=entry.path();latestTime=t;}}
  if(latest.empty())return false;std::ifstream in(latest);std::string magic;int version=0;if(!(in>>magic>>version)||magic!="FL3BUILD"||version!=1)return false;
  std::size_t n=0;if(!(in>>n)||n>10000)return false;struct N{Vec2 p;bool pin;};std::vector<N> ns(n);
  for(auto& v:ns){int pin=0;if(!(in>>v.p.x>>v.p.y>>pin)||!std::isfinite(v.p.x)||!std::isfinite(v.p.y))return false;v.pin=pin!=0;}
  std::size_t m=0;if(!(in>>m)||m>20000)return false;struct M{std::size_t a,b;int material,role;};std::vector<M> ms(m);
  for(auto& v:ms)if(!(in>>v.a>>v.b>>v.material>>v.role)||v.a>=n||v.b>=n||v.material<0||v.material>static_cast<int>(MaterialKind::Concrete)||v.role<0||v.role>static_cast<int>(MemberRole::Rope))return false;
  std::size_t l=0;if(!(in>>l)||l>5000)return false;struct L{Vec2 p;float mass;};std::vector<L> ls(l);for(auto& v:ls)if(!(in>>v.p.x>>v.p.y>>v.mass)||!std::isfinite(v.p.x)||!std::isfinite(v.p.y)||!std::isfinite(v.mass))return false;
  std::size_t q=0;if(!(in>>q)||q>2000)return false;struct Q{int kind;Vec2 a,b;};std::vector<Q> qs(q);for(auto& v:qs)if(!(in>>v.kind>>v.a.x>>v.a.y>>v.b.x>>v.b.y)||v.kind<0||v.kind>2)return false;
  std::size_t e=0;if(!(in>>e)||e>2000)return false;std::vector<Vec2> exits(e);for(auto& v:exits)if(!(in>>v.x>>v.y)||!std::isfinite(v.x)||!std::isfinite(v.y))return false;
  world.clear();std::vector<NodeId> ids;ids.reserve(n);for(const auto& v:ns)ids.push_back(world.addNode(v.p,v.pin));
  for(const auto& v:ms)world.addMember(ids[v.a],ids[v.b],static_cast<MaterialKind>(v.material),static_cast<MemberRole>(v.role));
  for(const auto& v:ls)world.addLoad(v.p,v.mass);for(const auto& v:qs)world.addConnector(static_cast<ConnectorKind>(v.kind),v.a,v.b);
  app.exits=std::move(exits);app.selectedNode=0;app.selectedMember=0;app.firstNode=0;app.hasFirstConnectorPoint=false;app.paused=true;app.tool=Tool::Select;app.status="Loaded build: "+latest.stem().string();return true;
 }catch(...){return false;}
}

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
 for(const auto& e:a.exits){Vector2 p=worldToScreen(e,a);DrawCircleV(p,8,Color{105,196,157,255});DrawCircleLines((int)p.x,(int)p.y,13,Text);DrawText("EXIT",(int)p.x+11,(int)p.y-5,8,Color{145,220,180,255});}
 if(a.quickBuildDragging){Vector2 p0=worldToScreen(a.quickBuildStart,a),p1=worldToScreen(a.quickBuildEnd,a);DrawLineEx(p0,p1,5,Purple);DrawCircleV(p0,5,Lilac);DrawCircleV(p1,5,Lilac);}
 for(const auto&n:w.nodes()){Vector2 p=worldToScreen(n.position,a);Color c=n.pinned?Color{244,192,105,255}:Color{210,208,242,255};DrawCircleV(p,n.id==a.selectedNode?10:6,c);DrawCircleLines((int)p.x,(int)p.y,n.id==a.selectedNode?14:9,Color{30,29,54,255});}
 if(a.firstNode)for(const auto&n:w.nodes())if(n.id==a.firstNode){Vector2 p=worldToScreen(n.position,a);DrawCircleLines((int)p.x,(int)p.y,17,Purple);}
 EndScissorMode();
 DrawRectangle(14,Top+14,205,28,Color{8,8,18,230});DrawRectangleLines(14,Top+14,205,28,Line);DrawCircle(28,Top+28,4,a.paused?Color{237,173,99,255}:Color{105,196,157,255});DrawText(a.paused?"SIMULATION PAUSED":"LIVE STRUCTURAL PHYSICS",40,Top+22,9,Text);
 DrawText("GRID SCALE: 25 FT × 25 FT / CELL",235,Top+23,9,Muted);
 DrawRectangle(14,GetScreenHeight()-42,vw-28,27,Color{8,8,18,220});DrawRectangleLines(14,GetScreenHeight()-42,vw-28,27,Line);DrawText(a.status.c_str(),25,GetScreenHeight()-34,9,Muted);
 if(a.namingBuild){const float bx=vw*.5f-190,by=GetScreenHeight()*.5f-65;DrawRectangle(0,Top,vw,GetScreenHeight()-Top,Color{0,0,0,170});DrawRectangleRounded({bx,by,380,130},.06f,8,Panel);DrawRectangleRoundedLines({bx,by,380,130},.06f,8,Purple);DrawText("SAVE BUILD",static_cast<int>(bx+20),static_cast<int>(by+18),18,Text);DrawText(a.buildName.c_str(),static_cast<int>(bx+20),static_cast<int>(by+54),16,Lilac);DrawText("Type a name · ENTER to save · ESC to cancel",static_cast<int>(bx+20),static_cast<int>(by+96),10,Muted);}
}
void drawSidebar(StructuralWorld&w,App&a){
 const int x=GetScreenWidth()-Side,height=GetScreenHeight();
 const bool compact=height<850;
 DrawRectangle(x,Top,Side,height-Top,Panel);DrawLine(x,Top,x,height,Line);
 DrawText("STRUCTURAL LAB",x+20,80,9,Purple);DrawText("Toolbox",x+20,101,26,Text);DrawLine(x+18,140,x+Side-18,140,Line);DrawText("TOOLS",x+20,158,9,Muted);
 const char* names[]={"Select","Add node","Connect","Rope","Add load","Heat","Explode","Ignite","Ladder","Stairs","Elevator","Beam","Column","Brace","Floor","Wall","Break","Delete","Exit"};
 Tool tools[]={Tool::Select,Tool::Node,Tool::Member,Tool::Rope,Tool::Load,Tool::Heat,Tool::Explode,Tool::Ignite,Tool::Ladder,Tool::Stairs,Tool::Elevator,Tool::QuickBeam,Tool::QuickColumn,Tool::QuickBrace,Tool::Floor,Tool::Wall,Tool::Break,Tool::Delete,Tool::Exit};
 const float toolStart=compact?160.0f:180.0f,toolStep=compact?31.0f:37.0f,toolHeight=compact?27.0f:32.0f;
 const float toolWidth=(Side-60.0f)/3.0f;
 for(int i=0;i<19;i++){
  const float bx=static_cast<float>(x+18)+(i%3)*(toolWidth+6.0f);
  const float by=toolStart+(i/3)*toolStep;
  if(button({bx,by,toolWidth,toolHeight},names[i],a.tool==tools[i])){
   a.tool=tools[i];a.firstNode=0;a.hasFirstConnectorPoint=false;a.quickBuildDragging=false;a.status=std::string(names[i])+" selected";
  }
 }
 const float materialLine=compact?398.0f:457.0f,materialTitle=compact?411.0f:473.0f,materialStart=compact?430.0f:494.0f,materialStep=compact?27.0f:31.0f,materialHeight=compact?23.0f:25.0f;
 DrawLine(x+18,materialLine,x+Side-18,materialLine,Line);DrawText("MATERIAL",x+20,(int)materialTitle,9,Muted);
 MaterialKind mats[]={MaterialKind::Steel,MaterialKind::Wood,MaterialKind::ExplosiveComposite,MaterialKind::FlammableComposite,MaterialKind::Concrete};
 for(int i=0;i<5;i++){float bx=x+18+(i%2)*130,by=materialStart+(i/2)*materialStep;if(button({bx,by,122,materialHeight},materialName(mats[i]),a.material==mats[i]))a.material=mats[i];}
 const float simulationLine=compact?522.0f:600.0f,simulationTitle=compact?535.0f:613.0f,simulationStart=compact?554.0f:632.0f,simulationStep=compact?24.0f:29.0f,simulationHeight=compact?21.0f:24.0f;
 DrawLine(x+18,simulationLine,x+Side-18,simulationLine,Line);DrawText("SIMULATION",x+20,(int)simulationTitle,9,Muted);
 if(button({(float)x+18,simulationStart,Side-36.0f,simulationHeight},a.paused?"Resume":"Pause"))a.paused=!a.paused;
 if(button({(float)x+18,simulationStart+simulationStep,Side-36.0f,simulationHeight},"Reset experiment")){w.resetDemo();a.selectedNode=0;a.selectedMember=0;a.firstNode=0;}
 if(button({(float)x+18,simulationStart+2*simulationStep,Side-36.0f,simulationHeight},a.stress?"Stress overlay: ON":"Stress overlay: OFF"))a.stress=!a.stress;
 DrawLine(x+18,compact?620:725,x+Side-18,compact?620:725,Line);
 if(compact){
  DrawText(TextFormat("%i nodes / %i members",(int)w.nodeCount(),(int)w.memberCount()),x+20,height-52,9,Text);
  DrawText(TextFormat("%i failed members",(int)w.brokenMemberCount()),x+20,height-36,8,Color{232,143,116,255});
  DrawText(TextFormat("%i connectors / %i falling  ·  GRID 25 FT × 25 FT/CELL",
   (int)w.connectorCount(),(int)w.fallingConnectorCount()),x+20,height-17,7,Muted);
 }else{
  DrawText(TextFormat("%i nodes  /  %i members",(int)w.nodeCount(),(int)w.memberCount()),x+20,746,11,Text);
  DrawText(TextFormat("%i failed members",(int)w.brokenMemberCount()),x+20,768,10,Color{232,143,116,255});
  DrawText(TextFormat("%i connectors  /  %i falling",(int)w.connectorCount(),(int)w.fallingConnectorCount()),x+20,785,8,Muted);
  DrawText("GRID SCALE / 25 FT × 25 FT",x+20,height-44,8,Muted);
 }
}
void input(StructuralWorld&w,App&a){
 Vector2 mouse=GetMousePosition();
 if(a.namingBuild){
  int ch=GetCharPressed();while(ch>0){if(ch>=32&&ch<127&&a.buildName.size()<48)a.buildName.push_back(static_cast<char>(ch));ch=GetCharPressed();}
  if(IsKeyPressed(KEY_BACKSPACE)&&!a.buildName.empty())a.buildName.pop_back();
  if(IsKeyPressed(KEY_ENTER)){a.namingBuild=false;a.buildName=safeBuildName(a.buildName);a.status=saveBuild(w,a)?"Build saved: "+a.buildName:"Could not save build";}
  if(IsKeyPressed(KEY_ESCAPE))a.namingBuild=false;return;
 }
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
 if(IsKeyPressed(KEY_B))chooseTool(Tool::QuickBeam);
 if(IsKeyPressed(KEY_C))chooseTool(Tool::QuickColumn);
 if(IsKeyPressed(KEY_D))chooseTool(Tool::QuickBrace);
 if(IsKeyPressed(KEY_F))chooseTool(Tool::Floor);
 if(IsKeyPressed(KEY_W))chooseTool(Tool::Wall);
 if(IsKeyPressed(KEY_K))chooseTool(Tool::Break);
 if(mouse.x>GetScreenWidth()-Side||mouse.y<Top)return;
 if(IsMouseButtonDown(MOUSE_BUTTON_MIDDLE)){Vector2 d=GetMouseDelta();a.pan.x+=d.x;a.pan.y+=d.y;}
 float wheel=GetMouseWheelMove();if(wheel!=0&&inView(mouse))a.zoom=clampf(a.zoom+wheel*.08f,.45f,2.4f);
 if(a.tool==Tool::Heat&&IsMouseButtonDown(MOUSE_BUTTON_LEFT)&&inView(mouse)){w.applyHeat(screenToWorld(mouse,a),1.7f,520,GetFrameTime());return;}
 if(a.tool==Tool::QuickBeam||a.tool==Tool::QuickColumn||a.tool==Tool::QuickBrace){
  if(IsMouseButtonPressed(MOUSE_BUTTON_LEFT)&&inView(mouse)){a.quickBuildDragging=true;a.quickBuildStart=screenToWorld(mouse,a);a.quickBuildEnd=a.quickBuildStart;}
  if(a.quickBuildDragging&&IsMouseButtonDown(MOUSE_BUTTON_LEFT)&&inView(mouse))a.quickBuildEnd=screenToWorld(mouse,a);
  if(a.quickBuildDragging&&IsMouseButtonReleased(MOUSE_BUTTON_LEFT)){
   Vec2 p0=a.quickBuildStart,p1=screenToWorld(mouse,a);a.quickBuildDragging=false;
   if(a.tool==Tool::QuickBeam)p1.y=p0.y;
   else if(a.tool==Tool::QuickColumn)p1.x=p0.x;
   else {float dx=p1.x-p0.x,dy=p1.y-p0.y;float span=std::max(std::fabs(dx),std::fabs(dy));p1.x=p0.x+(dx<0?-span:span);p1.y=p0.y+(dy<0?-span:span);}
   NodeId n0=w.findNodeNear(p0,.38f);if(!n0)n0=w.addNode(p0,false);
   NodeId n1=w.findNodeNear(p1,.38f);if(!n1)n1=w.addNode(p1,false);
   const MemberRole role=a.tool==Tool::QuickColumn?MemberRole::Column:a.tool==Tool::QuickBrace?MemberRole::Brace:MemberRole::Beam;
   MemberId id=w.addMember(n0,n1,a.material,role);a.selectedMember=id;a.status=id?"Quick-built "+std::string(a.tool==Tool::QuickColumn?"column":a.tool==Tool::QuickBrace?"brace":"beam"):"Quick Build needs a longer drag";return;
  }
  if(a.quickBuildDragging)return;
 }
 if(a.tool==Tool::Ignite&&IsMouseButtonDown(MOUSE_BUTTON_LEFT)&&inView(mouse)){w.ignite(screenToWorld(mouse,a),.55f);return;}
 if(IsMouseButtonPressed(MOUSE_BUTTON_RIGHT)&&inView(mouse)){NodeId n=w.findNodeNear(screenToWorld(mouse,a),.28f);if(n)w.toggleNodePin(n);return;}
 if(!IsMouseButtonPressed(MOUSE_BUTTON_LEFT)||!inView(mouse))return;
 Vec2 p=screenToWorld(mouse,a);
 if(a.tool==Tool::Node){a.selectedNode=w.addNode(p,false);a.status="Node added";return;}
 if(a.tool==Tool::Exit){a.exits.push_back(p);a.status="Evacuation exit marker placed";return;}
 if(a.tool==Tool::Break||a.tool==Tool::Delete){MemberId target=w.findMemberNear(p,.30f);if(target){w.removeMember(target);a.status=a.tool==Tool::Break?"Member fractured — fragments released":"Member deleted";if(a.selectedMember==target)a.selectedMember=0;}else{NodeId node=w.findNodeNear(p,.28f);if(node){w.removeNode(node);a.status="Node deleted";}else{auto load=w.findLoadNear(p,.4f);if(load){w.removeLoad(load);a.status="Load deleted";}else a.status="Nothing to remove here";}}return;}
 if(a.tool==Tool::Floor||a.tool==Tool::Wall){NodeId n=w.findNodeNear(p,.34f);if(!n){a.status="Floor/Wall mode: click existing frame nodes";return;}if(!a.firstNode){a.firstNode=n;a.status="First support selected — click the opposite support";return;}Vec2 start{},end{};w.getNodePosition(a.firstNode,start);w.getNodePosition(n,end);if(a.tool==Tool::Floor){Vec2 aligned{end.x,start.y};NodeId panelEnd=w.addNode(aligned,false);w.addMember(n,panelEnd,a.material,MemberRole::Column);MemberId panel=w.addMember(a.firstNode,panelEnd,a.material,MemberRole::Slab);a.selectedMember=panel;a.status=panel?"Floor panel snapped level and connected":"Could not create floor panel";}else{Vec2 aligned{start.x,end.y};NodeId panelEnd=w.addNode(aligned,false);w.addMember(n,panelEnd,a.material,MemberRole::Beam);MemberId panel=w.addMember(a.firstNode,panelEnd,a.material,MemberRole::Wall);a.selectedMember=panel;a.status=panel?"Wall panel snapped plumb and connected":"Could not create wall panel";}a.firstNode=0;return;}
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
   DrawText("2D STRUCTURAL SIMULATION",GetScreenWidth()-Side-220,22,9,Muted);
   if(button({static_cast<float>(GetScreenWidth()-Side-245),10,105,36},"Save Build")){app.namingBuild=true;app.buildName="My Build";}
   if(button({static_cast<float>(GetScreenWidth()-Side-130),10,115,36},"Load Latest")){app.status=loadLatestBuild(world,app)?"Latest saved build loaded":"No valid saved build found";}
   drawWorld(world,app);drawSidebar(world,app);
  }
  EndDrawing();
 }
 CloseWindow();return 0;
}
#ifdef _WIN32
int main();
int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) { return main(); }
#endif
