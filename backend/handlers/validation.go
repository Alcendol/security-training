package handlers

import (
	"errors"
	"fmt"
	"strings"
	"unicode"

	"github.com/go-playground/validator/v10"
)

func formatValidationError(err error) string {
	var verrs validator.ValidationErrors
	if !errors.As(err, &verrs) {
		return "Invalid request body. Please check the JSON format."
	}

	messages := make([]string, 0, len(verrs))
	for _, fe := range verrs {
		messages = append(messages, fieldErrorMessage(fe))
	}
	return strings.Join(messages, ". ")
}

func fieldErrorMessage(fe validator.FieldError) string {
	field := strings.ToLower(fe.Field())

	var msg string
	switch fe.Tag() {
	case "required":
		msg = fmt.Sprintf("%s is required", field)
	case "email":
		msg = "email must be a valid email address"
	case "min":
		msg = fmt.Sprintf("%s must be at least %s characters long", field, fe.Param())
	case "max":
		msg = fmt.Sprintf("%s must be at most %s characters long", field, fe.Param())
	case "oneof":
		allowed := strings.ReplaceAll(fe.Param(), " ", ", ")
		msg = fmt.Sprintf("%s must be one of: %s", field, allowed)
	default:
		msg = fmt.Sprintf("%s is invalid", field)
	}

	return capitalizeFirst(msg)
}

func capitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	r := []rune(s)
	r[0] = unicode.ToUpper(r[0])
	return string(r)
}
