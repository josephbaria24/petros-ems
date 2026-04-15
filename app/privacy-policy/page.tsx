import Link from "next/link"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">
              Effective date: April 15, 2026
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              This Privacy Policy explains how Petrosphere Inc. Training Management System
              collects, uses, stores, and protects personal information submitted through
              registration forms, payment workflows, file upload pages, course administration,
              and related features in this platform.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1. Information we collect</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Depending on your registration flow, we may collect the following information:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Personal details (first name, last name, middle initial, suffix, email, mobile
                number, gender, age, mailing address, civil status, nationality, religion, and
                related profile details).
              </li>
              <li>
                Employment and organization details (employment status, company name, position,
                industry, company contact details, and location).
              </li>
              <li>
                Student-related data when applicable (student indicator and school name).
              </li>
              <li>
                Course registration details (selected course, schedule, event type, branch,
                batch information, discount usage, voucher usage, and booking reference).
              </li>
              <li>
                Uploaded files and documents (government IDs, 2x2 photos, PRC licenses,
                signatures, receipts, and any custom files required by a specific course).
              </li>
              <li>
                Payment data (payment method, amount paid, payment status, receipt links, and
                related payment history records).
              </li>
              <li>
                Communication and operations records (email template usage, notifications,
                activity timestamps, approval/decline statuses, and operational logs related to
                training administration).
              </li>
              <li>
                Training and certificate records (certificate number/serial data, completion
                metadata, and report-level aggregates tied to registered trainees).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2. How we use your information</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>To process course registration, scheduling, and trainee enrollment.</li>
              <li>To validate submissions and required documents for training compliance.</li>
              <li>To manage billing, receipt verification, and payment follow-up.</li>
              <li>
                To send transactional messages (for example: booking confirmations, payment
                updates, schedule updates, certificate emails, and support notices).
              </li>
              <li>
                To generate certificates, training reports, and internal administrative records.
              </li>
              <li>
                To improve form workflows, course operations, and service reliability and
                security.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3. Legal basis and consent</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              By submitting forms in this system, you consent to the collection and processing of
              your information for training registration, payment handling, documentation, and
              related service operations. Where required, processing is also performed for
              legitimate business interests, contractual obligations, and legal compliance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4. Data sharing and disclosure</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We do not sell personal data. Information may be shared only as needed with:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Authorized internal staff and administrators managing course operations.</li>
              <li>
                Service providers used by this platform (for example, cloud database, email
                delivery, and secure file storage/upload infrastructure).
              </li>
              <li>
                Regulatory or lawful authorities when disclosure is required by applicable law,
                regulation, court order, or legal process.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5. Data retention</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We retain data only for as long as necessary to fulfill registration, training,
              payment verification, certification, reporting, legal, and audit requirements.
              Retention periods may vary by record type (for example, payments, training records,
              and certificate logs).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6. Security measures</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We apply reasonable administrative, technical, and organizational safeguards to
              protect your information from unauthorized access, alteration, disclosure, or loss.
              While no method is completely risk-free, we continuously improve controls in line
              with operational and compliance needs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7. Your rights</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Subject to applicable law, you may request access to, correction of, or deletion of
              your personal data, or ask questions about how your information is processed.
              Verification may be required before fulfilling requests.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8. Third-party links</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Some pages or emails may contain links to third-party services. Their privacy
              practices are governed by their own policies, and we encourage you to review them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">9. Updates to this policy</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              We may update this Privacy Policy from time to time to reflect operational, legal,
              or system changes. The latest version will always be available on this page.
            </p>
          </section>

          <section className="rounded-lg border bg-muted/20 p-4">
            <h2 className="text-base font-semibold">Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              For privacy inquiries, contact us at{" "}
              <a href="mailto:training@petrosphere.com.ph" className="underline">
                training@petrosphere.com.ph
              </a>
              .
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              You may also return to the{" "}
              <Link href="/guest-training-calendar" className="underline">
                training calendar
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
