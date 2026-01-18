import { Vector3, PerspectiveCamera } from 'three';
import { SpaceshipController } from './SpaceshipController';
import { CONFIG } from '../config';

export class TPSCamera {
  update(camera: PerspectiveCamera, spaceship: SpaceshipController) {
    const { CAMERA_OFFSET, CAMERA_LERP_FACTOR, CAMERA_LOOK_TARGET_DIST } = CONFIG;

    const offsetVec = new Vector3(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);
    offsetVec.applyQuaternion(spaceship.quaternion);

    const targetPos = spaceship.position.clone().add(offsetVec);

    camera.position.lerp(targetPos, CAMERA_LERP_FACTOR);

    const lookTarget = spaceship.position.clone().add(
      new Vector3(0, 0, CAMERA_LOOK_TARGET_DIST).applyQuaternion(spaceship.quaternion)
    );
    camera.lookAt(lookTarget);
  }
}
