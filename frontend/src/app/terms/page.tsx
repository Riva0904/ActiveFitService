export const metadata = { title: 'Terms of Service' };

export default function TermsOfServicePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 prose prose-sm dark:prose-invert">
      <h1>Terms of Service</h1>
      <p>Last updated: placeholder — replace with your actual terms before launch.</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By using ActiveFit, you agree to these terms and your gym&apos;s membership policies.</p>

      <h2>2. Memberships and Payments</h2>
      <p>Membership plans, pricing, and renewal terms are set by your gym. Payments are processed via Razorpay (INR only).</p>

      <h2>3. Account Responsibilities</h2>
      <p>You are responsible for keeping your login credentials secure and your profile information accurate.</p>

      <h2>4. Termination</h2>
      <p>Either party may terminate the membership per your gym&apos;s cancellation policy. You may request account deletion at any time.</p>

      <h2>5. Limitation of Liability</h2>
      <p>ActiveFit provides the platform as-is; your gym is responsible for the services delivered at its facility.</p>
    </main>
  );
}
