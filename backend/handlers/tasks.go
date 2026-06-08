package handlers

import (
	"html"
	"net/http"
	"securetask/database"
	"securetask/models"

	"github.com/gin-gonic/gin"
)

type CreateTaskRequest struct {
	Title       string `json:"title" binding:"required,max=200"`
	Description string `json:"description" binding:"max=2000"`
	Priority    string `json:"priority" binding:"omitempty,oneof=low medium high"`
}

type UpdateTaskRequest struct {
	Title       *string `json:"title" binding:"omitempty,max=200"`
	Description *string `json:"description" binding:"omitempty,max=2000"`
	Priority    *string `json:"priority" binding:"omitempty,oneof=low medium high"`
	Status      *string `json:"status" binding:"omitempty,oneof=todo in_progress done"`
}

func GetTasks(c *gin.Context) {
	userID := c.GetUint("user_id")

	var tasks []models.Task
	database.DB.Where("user_id = ?", userID).Preload("User").Find(&tasks)

	c.JSON(http.StatusOK, tasks)
}

func CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": formatValidationError(err)})
		return
	}

	userID := c.GetUint("user_id")

	task := models.Task{
		Title:       html.EscapeString(req.Title),
		Description: html.EscapeString(req.Description),
		Priority:    req.Priority,
		Status:      "todo",
		UserID:      userID,
	}

	if err := database.DB.Create(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func UpdateTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := c.GetUint("user_id")

	var task models.Task
	if err := database.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": formatValidationError(err)})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = html.EscapeString(*req.Title)
	}
	if req.Description != nil {
		updates["description"] = html.EscapeString(*req.Description)
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	database.DB.Model(&task).Updates(updates)

	c.JSON(http.StatusOK, task)
}

func DeleteTask(c *gin.Context) {
	taskID := c.Param("id")
	userID := c.GetUint("user_id")

	var task models.Task
	if err := database.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if err := database.DB.Delete(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted"})
}

func SearchTasks(c *gin.Context) {
	searchTerm := c.Query("q")

	if searchTerm == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search term required"})
		return
	}

	userID := c.GetUint("user_id")
	pattern := "%" + searchTerm + "%"

	var tasks []models.Task
	if err := database.DB.
		Where("user_id = ? AND (title ILIKE ? OR description ILIKE ?)", userID, pattern, pattern).
		Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	c.JSON(http.StatusOK, tasks)
}
