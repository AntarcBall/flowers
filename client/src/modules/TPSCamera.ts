import { Vector3, PerspectiveCamera, Euler } from 'three';
import { SpaceshipController } from './SpaceshipController';
import { CONFIG } from '../config';

export class TPSCamera {
  private readonly lookTarget = new Vector3();
  private readonly shipForward = new Vector3();
  private readonly flatForward = new Vector3();
  private readonly offsetVec = new Vector3();
  private readonly targetPos = new Vector3();
  private readonly targetLook = new Vector3();
  private readonly lookDir = new Vector3(0, 0, 1);
  private initialized = false;

  update(camera: PerspectiveCamera, spaceship: SpaceshipController, delta = 1 / 60) {
    const { CAMERA_OFFSET, CAMERA_LERP_FACTOR, CAMERA_LOOK_TARGET_DIST } = CONFIG;

    this.shipForward.set(0, 0, 1).applyQuaternion(spaceship.quaternion);
    this.lookDir.copy(this.shipForward).normalize();

    if (this.lookDir.lengthSq() <= 0.000001) {
      this.lookDir.set(0, 0, 1);
    }

    this.flatForward.copy(this.lookDir);
    this.shipForward.y = 0;
    if (this.flatForward.lengthSq() < 0.0001) {
      this.flatForward.set(0, 0, 1);
    } else {
      this.flatForward.normalize();
    }
    const yaw = Math.atan2(this.flatForward.x, this.flatForward.z);
    const yawQuat = new Euler(0, yaw, 0);

    this.offsetVec.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z).applyEuler(yawQuat);
    this.targetPos.copy(spaceship.position).add(this.offsetVec);

    this.targetLook
      .copy(spaceship.position)
      .addScaledVector(this.lookDir, CAMERA_LOOK_TARGET_DIST);

    const lag = Math.min(1, CAMERA_LERP_FACTOR * Math.max(delta * 60, 0.0));

    if (CAMERA_LERP_FACTOR >= 1 || lag >= 0.9999) {
      camera.position.copy(this.targetPos);
      camera.lookAt(this.targetLook);
      this.lookTarget.copy(this.targetLook);
      this.initialized = true;
      return;
    }

    if (!this.initialized) {
      camera.position.copy(this.targetPos);
      this.lookTarget.copy(this.targetLook);
      this.initialized = true;
      return;
    }

    camera.position.lerp(this.targetPos, lag);
    this.lookTarget.lerp(this.targetLook, lag);
    camera.lookAt(this.lookTarget);
  }
}
