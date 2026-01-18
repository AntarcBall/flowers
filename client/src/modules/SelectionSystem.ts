import { Vector3 } from 'three';
import { CONFIG } from '../config';

export class SelectionSystem {
    
    // Returns the closest star that falls within the cone
    static getBestTarget(
        shipPos: Vector3, 
        shipForward: Vector3, 
        stars: Array<{position: Vector3, id: number}>
    ): number | null {
        
        let bestTargetId: number | null = null;
        let minDist = Infinity;

        for (const star of stars) {
            const toStar = new Vector3().subVectors(star.position, shipPos);
            const dist = toStar.length();
            
            if (dist === 0) continue; 

            toStar.normalize();
            
            // Dot product = cos(angle)
            // If angle < threshold, then cos(angle) > cos(threshold)
            const dot = shipForward.dot(toStar);
            const threshold = Math.cos(CONFIG.CONE_ANGLE_THRESHOLD);

            if (dot > threshold) {
                if (dist < minDist) {
                    minDist = dist;
                    bestTargetId = star.id;
                }
            }
        }
        
        return bestTargetId;
    }
}
