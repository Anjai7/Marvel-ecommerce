/**
 * Customer profile details and addresses view tab.
 */
export default function CustomerProfileTab({ currentUser }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        padding: 28,
        border: "1px solid #e2e8f0",
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>
        Personal Details & Addresses
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: 20,
          maxWidth: 640,
        }}
      >
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#475569",
              display: "block",
              marginBottom: 6,
            }}
          >
            Full Name
          </label>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontWeight: 600,
            }}
          >
            {currentUser?.full_name || "Alex Customer"}
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#475569",
              display: "block",
              marginBottom: 6,
            }}
          >
            Email Address
          </label>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontWeight: 600,
            }}
          >
            {currentUser?.email || "user@marvel.com"}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#475569",
              display: "block",
              marginBottom: 6,
            }}
          >
            Primary Delivery Address
          </label>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontWeight: 500,
            }}
          >
            742 Evergreen Terrace, Springfield, OR 97477, United States
          </div>
        </div>
      </div>
    </div>
  );
}
