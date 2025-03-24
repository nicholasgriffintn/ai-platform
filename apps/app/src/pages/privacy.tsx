import { APP_NAME, CONTACT_LINK, PRIVACY_EFFECTIVE_DATE } from "~/constants";
import { AppLayout } from "~/layouts/AppLayout";

export default function Privacy() {
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 overflow-y-auto">
        <h1 className="text-4xl font-bold mb-4 text-zinc-900 dark:text-white">
          Privacy Policy
        </h1>
        <div className="prose dark:prose-invert max-w-[840px]">
          <h2>1. Introduction</h2>
          <p>
            This Privacy Policy ("Policy") explains how {APP_NAME} ("we," "us,"
            or "our") collects, uses, discloses, and safeguards your information
            when you access or use our AI chatbot services ("Service"). We are
            committed to protecting your privacy and handling your data with
            transparency and care.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>2.1 Personal Information</h3>
          <p>Information that can be used to identify you, such as:</p>
          <ul>
            <li>
              Name, email address, and contact details provided during
              registration
            </li>
            <li>Account credentials and profile information</li>
            <li>Payment information, if applicable</li>
          </ul>

          <h3>2.2 Conversation Data</h3>
          <ul>
            <li>Text inputs and queries submitted to our chatbot</li>
            <li>Content of conversations and interactions with the Service</li>
            <li>Preferences and settings related to your use of the Service</li>
          </ul>

          <h3>2.3 Technical Information</h3>
          <ul>
            <li>IP address and location data</li>
            <li>
              Device information (browser type, operating system, hardware
              model)
            </li>
            <li>Log data and usage statistics</li>
            <li>Cookies and similar tracking technologies</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <h3>3.1 Providing and Maintaining the Service</h3>
          <ul>
            <li>Processing and responding to your queries</li>
            <li>Authenticating your identity and maintaining your account</li>
            <li>Delivering the core functionality of our AI chatbot</li>
          </ul>

          <h3>3.2 Improving and Developing the Service</h3>
          <ul>
            <li>Analyzing usage patterns to enhance performance</li>
            <li>Training our AI models to improve response quality</li>
            <li>Debugging and fixing technical issues</li>
          </ul>

          <h3>3.3 Personalization and User Experience</h3>
          <ul>
            <li>Customizing responses based on your interaction history</li>
            <li>Remembering your preferences and settings</li>
            <li>Providing relevant recommendations</li>
          </ul>

          <h3>3.4 Legal and Compliance Purposes</h3>
          <ul>
            <li>Complying with applicable laws and regulations</li>
            <li>Protecting our legal rights and preventing misuse</li>
            <li>Enforcing our Terms of Service</li>
          </ul>

          <h2>4. Data Security</h2>
          <p>
            We implement industry-standard technical and organizational measures
            to protect your information.
          </p>

          <h2>5. Sharing Your Information</h2>
          <h3>5.1 Third-Party Service Providers</h3>
          <p>
            We may share information with trusted third parties who assist us in
            operating our Service, conducting business, or servicing you,
            provided they agree to keep this information confidential.
          </p>

          <h3>5.2 Legal Requirements</h3>
          <p>
            We may disclose your information if required by law, governmental
            request, or when necessary to protect our rights or the safety of
            users.
          </p>

          <h3>5.3 Business Transfers</h3>
          <p>
            If we are involved in a merger, acquisition, or sale of assets, your
            information may be transferred as part of that transaction.
          </p>

          <h3>5.4 With Your Consent</h3>
          <p>
            We may share your information with third parties when you explicitly
            consent to such sharing.
          </p>

          <h2>6. Your Rights and Choices</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access, correct, or delete your personal information</li>
            <li>Object to or restrict certain processing of your data</li>
            <li>Request portability of your personal data</li>
            <li>Opt out of certain communications and marketing</li>
            <li>Withdraw consent where processing is based on consent</li>
          </ul>
          <p>
            To exercise these rights, please use the relevant features in your
            account settings or contact us directly.
          </p>

          <h2>7. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to
            fulfill the purposes outlined in this Policy, unless a longer
            retention period is required or permitted by law.
          </p>

          <h2>8. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries
            other than your country of residence. We ensure appropriate
            safeguards are in place to protect your information during such
            transfers.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            Our Service is not directed to children under the age of 13 (or the
            applicable age in your jurisdiction). We do not knowingly collect
            personal information from children.
          </p>

          <h2>10. Legal Compliance</h2>
          <h3>10.1 General Data Protection Regulation (GDPR)</h3>
          <p>
            For users in the European Economic Area, we process personal data in
            accordance with GDPR principles, including:
          </p>
          <ul>
            <li>Lawfulness, fairness, and transparency</li>
            <li>Purpose limitation and data minimization</li>
            <li>Accuracy and storage limitation</li>
            <li>Integrity, confidentiality, and accountability</li>
          </ul>

          <h3>10.2 California Consumer Privacy Act (CCPA)</h3>
          <p>
            For California residents, we provide rights and protections as
            required by the CCPA, including:
          </p>
          <ul>
            <li>Right to know what personal information is collected</li>
            <li>
              Right to know whether personal information is sold or disclosed
            </li>
            <li>Right to opt-out of the sale of personal information</li>
            <li>Right to request deletion of personal information</li>
          </ul>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Policy from time to time. We will notify you of
            any changes by posting the new Policy on this page and updating the
            effective date. Continued use of the Service after such changes
            constitutes acceptance of the revised Policy.
          </p>

          <h2>12. Contact Us</h2>
          <p>
            If you have questions, concerns, or requests regarding this Privacy
            Policy or our data practices, please contact me at{" "}
            <a href={CONTACT_LINK}>{CONTACT_LINK}</a>.
          </p>

          <h2>13. Effective Date</h2>
          <p>
            This Privacy Policy is effective as of {PRIVACY_EFFECTIVE_DATE}.
          </p>

          <h2>14. Acceptance</h2>
          <p>
            By using {APP_NAME}, you acknowledge that you have read, understood,
            and agree to the terms of this Privacy Policy.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
