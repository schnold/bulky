import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, BlockStack, Text, Button, Box } from '@shopify/polaris';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class IframeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Iframe Error Boundary caught an error:', error, errorInfo);
    
    // Check if it's an iframe-related error
    if (error.message.includes('getElementById') || 
        error.message.includes('inject.js') ||
        error.message.includes('Cannot read properties of null')) {
      console.warn('Detected iframe-related error, attempting recovery...');
      
      // Try to recover by reloading the iframe context
      setTimeout(() => {
        if (window.parent && window.parent !== window) {
          try {
            window.parent.location.reload();
          } catch (e) {
            console.warn('Could not reload parent window:', e);
            // Fallback: reload current window
            window.location.reload();
          }
        } else {
          window.location.reload();
        }
      }, 2000);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box padding="400">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                App Loading Error
              </Text>
              <Text as="p">
                We encountered an issue loading the app. This is usually related to iframe communication 
                and should resolve automatically.
              </Text>
              <Text as="p" variant="bodyMd" color="subdued">
                Error: {this.state.error?.message}
              </Text>
              <Button 
                primary 
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                }}
              >
                Try Again
              </Button>
            </BlockStack>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}
