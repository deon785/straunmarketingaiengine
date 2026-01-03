
export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">1. Basic Rules</h2>
        <ul className="list-disc pl-5">
          <li>You must be 18+ to use this platform</li>
          <li>No illegal, stolen, or prohibited items</li>
          <li>No harassment, spam, or fake listings</li>
          <li>Transactions happen offline at your own risk</li>
        </ul>
      </section>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">2. Safety First</h2>
        <p>Meet in public places during daylight hours. Never share personal financial information.</p>
      </section>
      
      // Add these sections:
    <section className="mb-6">
    <h2 className="text-xl font-semibold mb-3">4. Limitation of Liability</h2>
    <p>We are not responsible for transactions between users...</p>
    </section>

    <section className="mb-6">
    <h2 className="text-xl font-semibold mb-3">5. User Content</h2>
    <p>You retain rights to your content but grant us license to display it...</p>
    </section>

    <section className="mb-6">
    <h2 className="text-xl font-semibold mb-3">6. Governing Law</h2>
    <p>These terms are governed by [Your Country/State] law...</p>
    </section>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">3. Account Termination</h2>
        <p>We may suspend accounts that violate these terms.</p>
      </section>
      
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Contact</h2>
        <p>Report issues: [deonmahachi8]@gmail.com</p>
      </section>
    </div>
  );
}