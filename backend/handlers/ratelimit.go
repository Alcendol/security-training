package handlers

import (
	"sync"
	"time"
)

// Brute force protection for the login endpoint
const (
	loginMaxAttempts     = 5
	loginAttemptWindow   = 15 * time.Minute
	loginLockoutDuration = 15 * time.Minute
)

type loginAttempt struct {
	failures    int
	windowStart time.Time
	lockedUntil time.Time
}

type loginLimiter struct {
	mu       sync.Mutex
	attempts map[string]*loginAttempt
}

var loginAttempts = &loginLimiter{
	attempts: make(map[string]*loginAttempt),
}

// allow reports whether a login attempt for key may proceed. When locked out it
// returns false along with the remaining lockout duration.
func (l *loginLimiter) allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	a, ok := l.attempts[key]
	if !ok {
		return true, 0
	}

	if now.Before(a.lockedUntil) {
		return false, time.Until(a.lockedUntil)
	}

	// Lockout expired or the failure window elapsed: discard the stale entry.
	if !a.lockedUntil.IsZero() || now.Sub(a.windowStart) > loginAttemptWindow {
		delete(l.attempts, key)
	}
	return true, 0
}

// recordFailure increments the failure counter for key and locks it out once the
// threshold is reached.
func (l *loginLimiter) recordFailure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	a, ok := l.attempts[key]
	if !ok || now.Sub(a.windowStart) > loginAttemptWindow {
		l.attempts[key] = &loginAttempt{failures: 1, windowStart: now}
		return
	}

	a.failures++
	if a.failures >= loginMaxAttempts {
		a.lockedUntil = now.Add(loginLockoutDuration)
	}
}

// reset clears any tracked failures for key after a successful login.
func (l *loginLimiter) reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}
