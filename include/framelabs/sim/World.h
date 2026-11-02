#pragma once

#include <any>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace framelabs {

using EntityId = std::uint64_t;

struct Entity {
  EntityId id = 0;
  std::string name;
};

struct TransformComponent {
  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;
  float vx = 0.0f;
  float vy = 0.0f;
  float vz = 0.0f;
};

struct PhysicsComponent {
  float mass = 1.0f;
  float drag = 0.1f;
};

struct RenderComponent {
  std::string meshName;
  float scale = 1.0f;
};

class World {
 public:
  World() = default;
  ~World() = default;

  EntityId createEntity(const std::string& name = "entity");
  void clear();

  template <typename T>
  void addComponent(EntityId entityId, T component) {
    auto& map = components_[entityId];
    map[typeid(T).name()] = component;
  }

  template <typename T>
  T* getComponent(EntityId entityId) {
    auto entityIt = components_.find(entityId);
    if (entityIt == components_.end()) {
      return nullptr;
    }

    auto componentIt = entityIt->second.find(typeid(T).name());
    if (componentIt == entityIt->second.end()) {
      return nullptr;
    }

    return std::any_cast<T>(&componentIt->second);
  }

  template <typename T>
  const T* getComponent(EntityId entityId) const {
    auto entityIt = components_.find(entityId);
    if (entityIt == components_.end()) {
      return nullptr;
    }

    auto componentIt = entityIt->second.find(typeid(T).name());
    if (componentIt == entityIt->second.end()) {
      return nullptr;
    }

    return std::any_cast<T>(&componentIt->second);
  }

  void update(float dt);

 private:
  EntityId nextEntityId_ = 1;
  std::unordered_map<EntityId, Entity> entities_;
  std::unordered_map<EntityId, std::unordered_map<std::string, std::any>> components_;
};

}  // namespace framelabs
