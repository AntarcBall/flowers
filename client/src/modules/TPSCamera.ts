import { Vector3, PerspectiveCamera, Euler } from 'three';
import { SpaceshipController } from './SpaceshipController';
import { CONFIG } from '../config';

export class TPSCamera {
  update(camera: PerspectiveCamera, spaceship: SpaceshipController) {
    const { CAMERA_OFFSET, CAMERA_LERP_FACTOR, CAMERA_LOOK_TARGET_DIST } = CONFIG;
    const shipForward = new Vector3(0, 0, 1).applyQuaternion(spaceship.quaternion);
    shipForward.y = 0;
    const flatForward = shipForward.lengthSq() < 0.0001
      ? new Vector3(0, 0, 1)
      : shipForward.normalize();
    const yaw = Math.atan2(flatForward.x, flatForward.z);
    const yawQuat = new Euler(0, yaw, 0);

    const offsetVec = new Vector3(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);
    offsetVec.applyEuler(yawQuat);

    const targetPos = spaceship.position.clone().add(offsetVec);

    if (CAMERA_LERP_FACTOR >= 1) {
      camera.position.copy(targetPos);
    } else {
      camera.position.lerp(targetPos, CAMERA_LERP_FACTOR);
    }

    const lookTarget = spaceship.position.clone().add(
      new Vector3(0, 0, CAMERA_LOOK_TARGET_DIST).applyEuler(yawQuat)
    );
    camera.lookAt(lookTarget);
  }
}
