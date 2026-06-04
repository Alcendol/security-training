package models

import (
	"time"
)

type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Email     string    `json:"email" gorm:"unique;not null"`
	Password  string    `json:"-" gorm:"not null"` // excluded from all JSON responses
	Name      string    `json:"name" gorm:"size:100"`
	Role      string    `json:"role" gorm:"size:20"` // admin or user
	Bio       string    `json:"bio" gorm:"size:500"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}


