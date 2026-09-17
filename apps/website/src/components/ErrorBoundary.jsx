import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "80px 24px", textAlign: "center", minHeight: "50vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#14110f", marginBottom: "12px" }}>Something went wrong.</h2>
          <p style={{ color: "#6f6a66", marginBottom: "24px", maxWidth: "480px" }}>An unexpected error occurred while loading this section.</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ padding: "10px 24px", background: "#fe6700", color: "#ffffff", border: "none", borderRadius: "999px", fontWeight: "700", cursor: "pointer" }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
