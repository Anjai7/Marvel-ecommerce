import "./customer-portal.css";

/**
 * Customer profile details and addresses view tab.
 */
export default function CustomerProfileTab({ currentUser }) {
  return (
    <div className="customer-profile">
      <h3 className="customer-profile__title">Personal Details &amp; Addresses</h3>
      <div className="customer-profile__grid">
        <div>
          <label className="customer-profile__label">Full Name</label>
          <div className="customer-profile__value">{currentUser?.full_name || "Alex Customer"}</div>
        </div>
        <div>
          <label className="customer-profile__label">Email Address</label>
          <div className="customer-profile__value">{currentUser?.email || "user@marvel.com"}</div>
        </div>
        <div className="customer-profile__field--wide">
          <label className="customer-profile__label">Primary Delivery Address</label>
          <div className="customer-profile__value customer-profile__value--regular">
            742 Evergreen Terrace, Springfield, OR 97477, United States
          </div>
        </div>
      </div>
    </div>
  );
}
