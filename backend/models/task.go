package models

import (
	"time"
)

type Task struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Title       string    `json:"title" gorm:"not null;size:200"`
	Description string    `json:"description" gorm:"size:2000"`
	Status      string    `json:"status" gorm:"size:20"`   // todo, in_progress, done
	Priority    string    `json:"priority" gorm:"size:20"` // low, medium, high
	UserID      uint      `json:"user_id"`
	User        User      `json:"user" gorm:"foreignKey:UserID"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
