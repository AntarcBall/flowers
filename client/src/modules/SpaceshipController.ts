import { Vector3, Quaternion, MathUtils } from 'three';
import { CONFIG } from '../config';

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const FIXED_SHIP_SPEED = 12;

export class SpaceshipController {
  position = new Vector3(0, 0, 0);
  quaternion = new Quaternion();
  speed = FIXED_SHIP_SPEED;
  angularVelocity = { pitch: 0, yaw: 0 };
  private readonly pitchQuaternion = new Quaternion();
  private readonly yawQuaternion = new Quaternion();
  private readonly forwardVector = new Vector3();

  update(
    deltaTime: number,
    inputState: Record<string, boolean>,
    speedScale = 1,
    wrapDistance = CONFIG.CUBE_SIZE,
  ): boolean {
    const { MAX_SPEED, ACCEL_ROT, DAMPING_ROT } = CONFIG;
    this.speed = MathUtils.clamp(FIXED_SHIP_SPEED * speedScale, 0, MAX_SPEED);

    if (inputState['w'] || inputState['W']) this.angularVelocity.pitch -= ACCEL_ROT;
    if (inputState['s'] || inputState['S']) this.angularVelocity.pitch += ACCEL_ROT;
    if (inputState['a'] || inputState['A']) this.angularVelocity.yaw += ACCEL_ROT;
    if (inputState['d'] || inputState['D']) this.angularVelocity.yaw -= ACCEL_ROT;

    this.angularVelocity.pitch *= DAMPING_ROT;
    this.angularVelocity.yaw *= DAMPING_ROT;

    this.pitchQuaternion.setFromAxisAngle(X_AXIS, this.angularVelocity.pitch);
    this.yawQuaternion.setFromAxisAngle(Y_AXIS, this.angularVelocity.yaw);

    this.quaternion.premultiply(this.yawQuaternion);
    this.quaternion.multiply(this.pitchQuaternion);

    const forwardVector = this.getForwardVector();
    this.position.addScaledVector(forwardVector, this.speed * deltaTime);

    let warped = false;
    if (
      wrapDistance !== Infinity &&
      (Math.abs(this.position.x) > wrapDistance ||
        Math.abs(this.position.y) > wrapDistance ||
        Math.abs(this.position.z) > wrapDistance)
    ) {
        this.position.set(0, 0, 0);
        warped = true;
    }
    
    return warped;
  }

  getForwardVector(out: Vector3 = this.forwardVector) {
    return out.set(0, 0, 1).applyQuaternion(this.quaternion).normalize();
  }
}
