package handlers

import (
	"fmt"
	"html"
	"net/http"
	"securetask/database"
	"securetask/models"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// VULNERABILITY #4: Hardcoded JWT secret
var jwtSecret = []byte("supersecret123")

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	Name     string `json:"name" binding:"required,max=100"`
}

func isStrongPassword(pw string) bool {
	var hasLetter, hasDigit bool
	for _, r := range pw {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	return hasLetter && hasDigit
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": formatValidationError(err)})
		return
	}

	if !isStrongPassword(req.Password) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must contain at least one letter and one number"})
		return
	}

	var existing models.User
	if err := database.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email is already registered"})
		return
	}

	// VULNERABILITY #5: Password stored in plain text (no hashing!)
	user := models.User{
		Email:    req.Email,
		Password: req.Password, // Should be hashed with bcrypt!
		Name:     html.EscapeString(req.Name),
		Role:     "user",
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// VULNERABILITY #2: Returning password in response
	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user":    user, // Contains password!
	})
}

// VULNERABILITY #2: No rate limiting - vulnerable to brute force attacks
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": formatValidationError(err)})
		return
	}

	var user models.User

	// VULNERABILITY #5: Plain text password comparison
	if err := database.DB.Where("email = ? AND password = ?", req.Email, req.Password).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// VULNERABILITY #2: Returning sensitive user data including password
	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  user, // Contains password!
	})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Remove "Bearer " prefix if present
		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", uint(claims["user_id"].(float64)))
			c.Set("email", claims["email"].(string))
			c.Set("role", claims["role"].(string))
		}

		c.Next()
	}
}
