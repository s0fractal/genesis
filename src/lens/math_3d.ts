// Minimal, zero-dependency 3D Math operations for WebGPU transforms.
// Specifically tailored to output Float32Arrays conforming strictly to mat4x4<f32>.

export type Mat4 = Float32Array;

export function createMat4(): Mat4 {
    const out = new Float32Array(16);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
}

export function mat4Multiply(out: Mat4, a: Mat4, b: Mat4) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
}

export function mat4Perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0;
    out[10] = far / (near - far);
    out[11] = -1;
    out[12] = 0; out[13] = 0;
    out[14] = (near * far) / (near - far);
    out[15] = 0;
    return out;
}

export function mat4LookAt(out: Mat4, eyeX: number, eyeY: number, eyeZ: number,
                           centerX: number, centerY: number, centerZ: number,
                           upX: number, upY: number, upZ: number) {
    let z0 = eyeX - centerX;
    let z1 = eyeY - centerY;
    let z2 = eyeZ - centerZ;

    let len = z0 * z0 + z1 * z1 + z2 * z2;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        z0 *= len; z1 *= len; z2 *= len;
    }

    let x0 = upY * z2 - upZ * z1;
    let x1 = upZ * z0 - upX * z2;
    let x2 = upX * z1 - upY * z0;

    len = x0 * x0 + x1 * x1 + x2 * x2;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        x0 *= len; x1 *= len; x2 *= len;
    }

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyeX + x1 * eyeY + x2 * eyeZ);
    out[13] = -(y0 * eyeX + y1 * eyeY + y2 * eyeZ);
    out[14] = -(z0 * eyeX + z1 * eyeY + z2 * eyeZ);
    out[15] = 1;

    return out;
}

export class OrbitCamera {
    public pitch: number = 0;
    public yaw: number = 0;
    public distance: number = 2.5;

    public targetX: number = 0;
    public targetY: number = 0;
    public targetZ: number = 0;

    private _projMatrix: Mat4 = createMat4();
    private _viewMatrix: Mat4 = createMat4();
    private _mvpMatrix: Mat4 = createMat4();

    public updateMVP(aspectRatio: number): Mat4 {
        // Construct Projection (Perspective WebGPU uses Right-Handed coordinates)
        mat4Perspective(this._projMatrix, Math.PI / 4, aspectRatio, 0.1, 100.0);

        // Convert Euler angles to Cartesian camera position
        const cp = Math.cos(this.pitch);
        const sp = Math.sin(this.pitch);
        const cy = Math.cos(this.yaw);
        const sy = Math.sin(this.yaw);

        const eyeX = this.targetX + this.distance * cp * sy; // Y-up Orbit
        const eyeY = this.targetY + this.distance * sp;
        const eyeZ = this.targetZ + this.distance * cp * cy;

        // Construct View Matrix (LookAt)
        mat4LookAt(this._viewMatrix, 
            eyeX, eyeY, eyeZ, 
            this.targetX, this.targetY, this.targetZ, 
            0, 1, 0 // Up vector
        );

        // MVP = Proj * View
        mat4Multiply(this._mvpMatrix, this._projMatrix, this._viewMatrix);
        return this._mvpMatrix;
    }
}
