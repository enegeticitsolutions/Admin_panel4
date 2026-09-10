import React, { useState } from "react";

const faqs = [
  {
    question: "Who is a Care Mitra?",
    answer:
      "A Care Mitra is a trained, background-verified care companion who visits your parent at home. Care Mitras are graded by skill level — from ANM to GNM, B.Sc Nurse, and Specialist Mitra — so your parent is matched with someone qualified for their specific health needs, not a one-size-fits-all attendant.",
  },
  {
    question: "How is MaiHoonNa different from hiring a caregiver directly?",
    answer:
      "When you hire independently, you're responsible for verifying background, training, backups when someone falls sick or quits, and you have no visibility into what actually happens during a visit. MaiHoonNa handles verification and training upfront, provides a replacement if your Care Mitra is unavailable, and gives you visit logs, health vitals, and mood tracking after every visit — plus an Emergency Response Coordinator on standby. You're paying for accountability and continuity, not just a person's time.",
  },
  {
    question: "What happens if I am not happy with my Care Mitra?",
    answer:
      "You rate and give feedback after every visit, so issues surface immediately rather than months later. If a match isn't working, our team can reassign a different Care Mitra to your parent.",
  },
  {
    question: "How does the Happiness Score work?",
    answer:
      "At each visit, your Care Mitra logs simple signals about your parent's mood and engagement, which we combine into a running Happiness Score you can see on the app. It's designed to catch a gradual decline — not just a bad day — so if the trend dips, both you and our care team are alerted to check in, well before a small issue becomes a bigger one.",
  },
  {
    question: "Can I manage care from abroad as an NRI?",
    answer:
      "Yes — this is one of the main reasons families use MaiHoonNa. The Family Connect app lets you track every visit, view health vitals, message the care team, and get emergency alerts in real time, from any time zone. Many of our subscribers are adult children living outside India who want a reliable, honest window into how their parent is actually doing.",
  },
  {
    question: "Is MaiHoonNa available outside Gurugram?",
    answer:
      "We're currently live in Gurugram (Sectors 53 to 57) as part of our pilot. We're planning to expand across the NCR region — reach out and we'll notify you as soon as we're live in your area.",
  },
  {
    question: "What does the Saathi Network do?",
    answer:
      "The Saathi Network is our community of volunteer companions who visit for conversation, company, and connection between your parent's scheduled Care Mitra visits — matched by gender, support needs, and proximity to keep visits comfortable and low-effort. It's built to address loneliness specifically, alongside the hands-on care your Care Mitra provides.",
  },
  {
    question: "Can I change or cancel my plan?",
    answer:
      "You can move between plans (Saathi Starter, Plus, Premium) as your parent's needs change. Please refer to our Terms and Conditions for the cancellation policy.",
  },
];

/**
 * FaqSection Component
 */
const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq">
      <div className="section-heading">
        <span>FAQ</span>
        <h2>Questions we hear often</h2>
        <p>
          Can't find what you're looking for? Write to us at{" "}
          <a href="mailto:info@maihoonna.com">info@maihoonna.com</a>
        </p>
      </div>

      <div className="faq-list">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={`faq-item${openIndex === index ? " open" : ""}`}
          >
            <button
              className="faq-question"
              onClick={() => toggle(index)}
              aria-expanded={openIndex === index}
            >
              <span>{faq.question}</span>
              <span className="faq-icon">{openIndex === index ? "−" : "+"}</span>
            </button>
            {openIndex === index && (
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default FaqSection;
