package main

import (
	"log"
	"os"
	"securetask/database"
	"securetask/handlers"
	"securetask/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Load .env file (only used in local development; in production use real env vars)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading environment variables from system")
	}
	handlers.LoadJWTSecret()

	// Initialize database (credentials read from environment inside Connect())
	database.Connect()

	// Auto-migrate models
	err := database.DB.AutoMigrate(&models.User{}, &models.Task{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Seed initial data
	seedData()

	// Setup Gin router
	r := gin.Default()

	// Restrict CORS to known origins in production.
	// Read allowed origin from env; default to localhost for local dev.
	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:5173"
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{allowedOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Public routes (no authentication required)
	r.POST("/api/auth/register", handlers.Register)
	r.POST("/api/auth/login", handlers.Login)
	r.POST("/api/auth/logout", handlers.Logout)

	// Protected routes (with auth middleware)
	authorized := r.Group("/api")
	authorized.Use(handlers.AuthMiddleware())
	{
		authorized.GET("/tasks", handlers.GetTasks)
		authorized.POST("/tasks", handlers.CreateTask)
		authorized.PUT("/tasks/:id", handlers.UpdateTask)
		authorized.GET("/tasks/search", handlers.SearchTasks)
		authorized.DELETE("/tasks/:id", handlers.DeleteTask)
		authorized.GET("/users/me", handlers.GetCurrentUser)
		authorized.PUT("/users/:id/profile", handlers.UpdateProfile)
		authorized.GET("/admin/users", handlers.GetAllUsers)
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 Server starting on port %s...", port)
	r.Run(":" + port)
}

func seedData() {
	// Check if users already exist
	var count int64
	database.DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		return // Data already seeded
	}

	type seedUser struct {
		Email    string
		Password string
		Name     string
		Role     string
		Bio      string
	}

	seeds := []seedUser{
		{
			Email:    "admin@example.com",
			Password: "admin123",
			Name:     "Admin User",
			Role:     "admin",
			Bio:      "I'm the administrator",
		},
		{
			Email:    "user@example.com",
			Password: "password123",
			Name:     "Regular User",
			Role:     "user",
			Bio:      "Just a regular user",
		},
	}

	for _, s := range seeds {
		hashed, err := bcrypt.GenerateFromPassword([]byte(s.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash seed password for %s: %v", s.Email, err)
		}
		user := models.User{
			Email:    s.Email,
			Password: string(hashed),
			Name:     s.Name,
			Role:     s.Role,
			Bio:      s.Bio,
		}
		database.DB.Create(&user)
	}

	log.Println("✅ Database seeded with initial users")
}
