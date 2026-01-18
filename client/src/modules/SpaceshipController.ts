import { Vector3, Quaternion, MathUtils } from 'three';
import { CONFIG } from '../config';

export class SpaceshipController {
  position = new Vector3(0, 0, 0);
  quaternion = new Quaternion();
  speed = 0;
  angularVelocity = { pitch: 0, yaw: 0 };

  update(deltaTime: number, inputState: Record<string, boolean>): boolean {
    const { MAX_SPEED, ACCEL_SPEED, ACCEL_ROT, DAMPING_ROT, CUBE_SIZE } = CONFIG;

    if (inputState['q'] || inputState['Q']) this.speed += ACCEL_SPEED;
    if (inputState['e'] || inputState['E']) this.speed -= ACCEL_SPEED;
    this.speed = MathUtils.clamp(this.speed, 0, MAX_SPEED);

    if (inputState['w'] || inputState['W']) this.angularVelocity.pitch += ACCEL_ROT;
    if (inputState['s'] || inputState['S']) this.angularVelocity.pitch -= ACCEL_ROT;
    if (inputState['a'] || inputState['A']) this.angularVelocity.yaw += ACCEL_ROT;
    if (inputState['d'] || inputState['D']) this.angularVelocity.yaw -= ACCEL_ROT;

    this.angularVelocity.pitch *= DAMPING_ROT;
    this.angularVelocity.yaw *= DAMPING_ROT;

    const pitchQuaternion = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), this.angularVelocity.pitch);
    const yawQuaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), this.angularVelocity.yaw);

    this.quaternion.multiply(pitchQuaternion).multiply(yawQuaternion);

    const forwardVector = new Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    this.position.addScaledVector(forwardVector, this.speed * deltaTime);

    let warped = false;
    if (Math.abs(this.position.x) > CUBE_SIZE || 
        Math.abs(this.position.y) > CUBE_SIZE || 
        Math.abs(this.position.z) > CUBE_SIZE) {
        this.position.set(0, 0, 0);
        warped = true;
    }
    
    return warped;
  }
}
