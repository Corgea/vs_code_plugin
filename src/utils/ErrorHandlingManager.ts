import * as vscode from "vscode";

// Sentry initialization
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "DSN",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});


export default class ErrorHandlingManager {
    /**
     * Decorator factory that creates a decorator with sync/async configuration
     * @param options - Configuration options for the decorator
     * @returns Decorator function
     */
    public static withErrorHandling(options: {
        isAsync?: boolean;
        customErrorMessage?: string;
        captureArgs?: boolean;
    } = {}) {
        return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
            const originalMethod = descriptor.value;
            const { isAsync = true, customErrorMessage, captureArgs = true } = options;

            if (isAsync) {
                // Handle async methods
                descriptor.value = async function (...args: any[]) {
                    try {
                        return await originalMethod.apply(this, args);
                    } catch (error) {
                        ErrorHandlingManager.handleError(error, {
                            method: propertyKey,
                            className: target.constructor.name,
                            args: captureArgs ? args : undefined,
                            customErrorMessage
                        });
                        throw error; // Re-throw to maintain original behavior
                    }
                };
            } else {
                // Handle sync methods
                descriptor.value = function (...args: any[]) {
                    try {
                        return originalMethod.apply(this, args);
                    } catch (error) {
                        ErrorHandlingManager.handleError(error, {
                            method: propertyKey,
                            className: target.constructor.name,
                            args: captureArgs ? args : undefined,
                            customErrorMessage
                        });
                        throw error; // Re-throw to maintain original behavior
                    }
                };
            }

            return descriptor;
        };
    }

    /**
     * Handle errors with Sentry integration
     * @param error - The error object
     * @param context - Additional context information
     */
    public static handleError(error: any, context?: {
        method?: string;
        className?: string;
        args?: any[];
        additionalData?: any;
        customErrorMessage?: string;
    }) {
        // Log to console for development
        console.error('Error occurred:', error);
        
        if (context) {
            console.error('Context:', context);
        }

        // Capture exception in Sentry
        Sentry.captureException(error, {
            tags: {
                method: context?.method || 'unknown',
                className: context?.className || 'unknown'
            },
            extra: {
                args: context?.args,
                additionalData: context?.additionalData
            }
        });

        // Show user-friendly error message
        const errorMessage = context?.customErrorMessage || `An error occurred: ${error.message || 'Unknown error'}`;
        vscode.window.showErrorMessage(errorMessage);
    }

    /**
     * Capture a message in Sentry
     * @param message - The message to capture
     * @param level - The severity level (fatal, error, warning, info, debug)
     * @param context - Additional context information
     */
    public static captureMessage(
        message: string, 
        level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
        context?: {
            method?: string;
            className?: string;
            additionalData?: any;
        }
    ) {
        Sentry.captureMessage(message, {
            level: level,
            tags: {
                method: context?.method || 'unknown',
                className: context?.className || 'unknown'
            },
            extra: {
                additionalData: context?.additionalData
            }
        });
    }

    /**
     * Set user context for Sentry
     * @param userId - User identifier
     * @param email - User email
     * @param username - Username
     */
    public static setUserContext(userId: string, email?: string, username?: string) {
        Sentry.setUser({
            id: userId,
            email: email,
            username: username
        });
    }


    /**
     * Flush Sentry events (useful for ensuring events are sent before process exit)
     */
    public static async flush() {
        await Sentry.flush(2000); // Wait up to 2 seconds for events to be sent
    }
}

// Export the decorator for easy use
export const withErrorHandling = ErrorHandlingManager.withErrorHandling;