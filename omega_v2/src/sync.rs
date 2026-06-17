//! Bare-metal Spinlock for OMEGA-64 (#![no_std] environments)
//! Replaces `static mut` to allow safe, lock-protected multi-threading via WebWorkers.

use core::cell::UnsafeCell;
use core::sync::atomic::{AtomicBool, Ordering};

/// A simple spinlock for #![no_std] targets.
pub struct Spinlock<T> {
    locked: AtomicBool,
    data: UnsafeCell<T>,
}

unsafe impl<T: Send> Sync for Spinlock<T> {}
unsafe impl<T: Send> Send for Spinlock<T> {}

impl<T> Spinlock<T> {
    /// Creates a new spinlock wrapping the supplied data.
    pub const fn new(data: T) -> Self {
        Self {
            locked: AtomicBool::new(false),
            data: UnsafeCell::new(data),
        }
    }

    /// Acquires the lock, spinning until it is available.
    #[cfg(target_has_atomic = "8")]
    pub fn lock(&self) -> SpinlockGuard<'_, T> {
        while self
            .locked
            .compare_exchange_weak(false, true, Ordering::Acquire, Ordering::Relaxed)
            .is_err()
        {
            core::hint::spin_loop();
        }
        SpinlockGuard { lock: self }
    }

    #[cfg(not(target_has_atomic = "8"))]
    pub fn lock(&self) -> SpinlockGuard<'_, T> {
        // No atomics available (e.g. thumbv6m, riscv32imc).
        // Safe because these are single-core embedded targets without threads.
        SpinlockGuard { lock: self }
    }

    /// Returns a raw pointer to the underlying data.
    /// WARNING: Bypasses the lock. Used EXCLUSIVELY for FFI / WebGPU zero-copy `.bss` access.
    pub fn as_mut_ptr(&self) -> *mut T {
        self.data.get()
    }
}

/// An RAII implementation of a "scoped lock" of a spinlock.
pub struct SpinlockGuard<'a, T> {
    lock: &'a Spinlock<T>,
}

impl<T> core::ops::Deref for SpinlockGuard<'_, T> {
    type Target = T;

    fn deref(&self) -> &T {
        unsafe { &*self.lock.data.get() }
    }
}

impl<T> core::ops::DerefMut for SpinlockGuard<'_, T> {
    fn deref_mut(&mut self) -> &mut T {
        unsafe { &mut *self.lock.data.get() }
    }
}

impl<T> Drop for SpinlockGuard<'_, T> {
    fn drop(&mut self) {
        #[cfg(target_has_atomic = "8")]
        self.lock.locked.store(false, Ordering::Release);
    }
}
