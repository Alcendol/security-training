package handlers

import (
	"net/http"
	"securetask/database"
	"securetask/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

func GetCurrentUser(c *gin.Context) {
	userID := c.GetUint("user_id")

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// VULNERABILITY #2: Returning password in response
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

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// VULNERABILITY #3: Bio field not sanitized - XSS vulnerability
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
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

	// VULNERABILITY #2: Returning all users with passwords!
	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"count": len(users),
	})
}
