import React from "react";
import { Card, Text, Button, BlockStack, Box } from "@shopify/polaris";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error('React Error Boundary caught an error:', error, errorInfo);
    
    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" tone="critical">
                Something went wrong
              </Text>
              <Text variant="bodyMd" as="p">
                The optimization encountered an error. This can happen due to network timeouts or temporary issues.
              </Text>
              <Button onClick={this.handleReset} variant="primary">
                Try Again
              </Button>
            </BlockStack>
          </Box>
        </Card>
      );
    }

    return this.props.children;
  }
} 