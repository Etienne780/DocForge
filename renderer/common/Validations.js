/**
 * @file validations.js
 * @brief Central validation configuration for input validation across the application.
 *
 * Defines reusable rules per entity type and standardized error message generators.
 * Adjust rules here to propagate changes application-wide.
 */

/** @brief Validation rules grouped by entity type. */
const VALIDATION_RULES = {
    PROJECT: {
        NAME_MIN_LENGTH: 3
    },
    THEME: {
        NAME_MIN_LENGTH: 3
    },
    LANGUAGE: {
        NAME_MIN_LENGTH: 2
    }
};

/** @brief Error message generators keyed by validation rule. */
const VALIDATION_ERRORS = {
    NAME_MIN_LENGTH: (min) => `Value must be at least ${min} characters long`
};

/**
 * @brief Retrieves a validation rule value for a given entity type.
 *
 * @param {string} type       - Entity type key (e.g. 'PROJECT', 'THEME').
 * @param {string} validation - Rule key within the entity (e.g. 'NAME_MIN_LENGTH').
 * @returns {number|string|undefined} The rule value, or undefined if not found.
 */
export function getValidation(type, validation) {
    if (!type || !validation) {
        console.error(`[Validations] getValidation() requires both 'type' and 'validation' arguments. Received: type=${type}, validation=${validation}`);
        return undefined;
    }

    if (!VALIDATION_RULES[type]) {
        console.error(`[Validations] Unknown entity type '${type}'. Valid types are: ${Object.keys(VALIDATION_RULES).join(', ')}`);
        return undefined;
    }

    if (VALIDATION_RULES[type][validation] === undefined) {
        console.error(`[Validations] Unknown rule '${validation}' for type '${type}'. Valid rules are: ${Object.keys(VALIDATION_RULES[type]).join(', ')}`);
        return undefined;
    }

    return VALIDATION_RULES[type][validation];
}

/**
 * @brief Returns a formatted validation error message.
 *
 * @param {string} type       - Entity type key (e.g. 'PROJECT', 'THEME').
 * @param {string} validation - Validation rule key (e.g. 'NAME_MIN_LENGTH').
 * @returns {string|undefined} Formatted error message, or undefined if lookup fails.
 */
export function getValidationError(type, validation) {
    if (!VALIDATION_ERRORS[validation]) {
        console.error(`[Validations] Unknown error rule '${validation}'. Valid rules are: ${Object.keys(VALIDATION_ERRORS).join(', ')}`);
        return undefined;
    }

    const value = getValidation(type, validation);

    if (value === undefined) {
        return undefined;
    }

    return VALIDATION_ERRORS[validation](value);
}