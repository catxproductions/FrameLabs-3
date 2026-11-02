#include <algorithm>
#include <chrono>
#include <cmath>

#include "framelabs/sim/FrameProfiler.h"
#include "framelabs/sim/World.h"

namespace framelabs {

void FrameProfiler::beginFrame() {
  frameStart_ = std::chrono::steady_clock::now();
}

void FrameProfiler::endFrame() {
  const auto now = std::chrono::steady_clock::now();
  const auto elapsedMs = std::chrono::duration<double, std::milli>(now - frameStart_).count();
  frameSamples_.push_back(elapsedMs);
  accumulatedMs_ += elapsedMs;
  worstFrameMs_ = std::max(worstFrameMs_, elapsedMs);
  ++frameCount_;

  if (frameSamples_.size() > 240) {
    frameSamples_.erase(frameSamples_.begin());
  }
}

double FrameProfiler::averageFrameMs() const noexcept {
  if (frameCount_ == 0) {
    return 0.0;
  }
  return accumulatedMs_ / static_cast<double>(frameCount_);
}

double FrameProfiler::worstFrameMs() const noexcept {
  return worstFrameMs_;
}

double FrameProfiler::fps() const noexcept {
  if (frameCount_ == 0) {
    return 0.0;
  }
  const double avgMs = averageFrameMs();
  return avgMs > 0.0 ? 1000.0 / avgMs : 0.0;
}

std::size_t FrameProfiler::frameCount() const noexcept {
  return frameCount_;
}

EntityId World::createEntity(const std::string& name) {
  EntityId id = nextEntityId_++;
  entities_[id] = Entity{id, name};
  return id;
}

void World::clear() {
  entities_.clear();
  components_.clear();
  nextEntityId_ = 1;
}

void World::update(float dt) {
  for (auto& [entityId, entityComponents] : components_) {
    auto* transform = getComponent<TransformComponent>(entityId);
    auto* physics = getComponent<PhysicsComponent>(entityId);
    if (transform == nullptr || physics == nullptr) {
      continue;
    }

    transform->x += transform->vx * dt;
    transform->y += transform->vy * dt;
    transform->z += transform->vz * dt;

    transform->vx *= (1.0f - physics->drag * dt);
    transform->vy *= (1.0f - physics->drag * dt);
    transform->vz *= (1.0f - physics->drag * dt);
  }
}

}  // namespace framelabs
