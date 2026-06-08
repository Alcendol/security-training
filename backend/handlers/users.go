package handlers

import (
	"html"
	"net/http"
	"securetask/database"
	"securetask/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

type UpdateProfileRequest struct {
	Name *string `json:"name" binding:"omitempty,max=100"`
	Bio  *string `json:"bio" binding:"omitempty,max=500"`
}

func GetCurrentUser(c *gin.Context) {
	userID := c.GetUint("user_id")

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Password is excluded from the response by json:"-" on the User model
	c.JSON(http.StatusOK, user)
}

func UpdateProfile(c *gin.Context) {
	targetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	userID := c.GetUint("user_id")
	if uint(targetID) != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only update your own profile"})
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": formatValidationError(err)})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = html.EscapeString(*req.Name)
	}
	if req.Bio != nil {
		updates["bio"] = html.EscapeString(*req.Bio)
	}

	database.DB.Model(&user).Updates(updates)

	c.JSON(http.StatusOK, user)
}

func GetAllUsers(c *gin.Context) {
	if c.GetString("role") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var users []models.User
	database.DB.Find(&users)

	// Password is excluded from the response by json:"-" on the User model
	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"count": len(users),
	})
}
