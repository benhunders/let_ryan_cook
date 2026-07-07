import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, emailLayout } from "@/lib/email";
import { paymentLabel } from "@/lib/payment";

function formatDeliveryDay(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Best-effort notification after a customer saves an order. Authorizes via the
// session and re-fetches the order server-side (never trusts client content):
//   • confirmation to the customer
//   • new-order alert to admins (Ryan)
export async function POST(request: Request) {
  const { menuId } = await request.json().catch(() => ({ menuId: null }));
  if (!menuId) {
    return NextResponse.json({ error: "menuId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Order + items in one query; item names come from the order-time snapshot.
  const { data: order } = await supabase
    .from("orders")
    .select("id, notes, payment_method, order_items(quantity, note, dish_name)")
    .eq("menu_id", menuId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: menu } = await supabase
    .from("menus")
    .select("title, delivery_date")
    .eq("id", menuId)
    .maybeSingle();

  const lines = order.order_items
    .map(
      (i) =>
        `<li>${i.quantity} × ${i.dish_name ?? "Dish"}${
          i.note ? ` <span style="color:#888">— ${i.note}</span>` : ""
        }</li>`
    )
    .join("");
  const itemsHtml = lines
    ? `<ul>${lines}</ul>`
    : "<p>(No dishes selected.)</p>";
  const menuTitle = menu?.title ?? "this week's menu";
  const customerName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "there";
  const payLine = `<p><strong>Paying by:</strong> ${paymentLabel(
    order.payment_method
  )}</p>`;
  const deliveryLine = menu?.delivery_date
    ? `<p><strong>Delivery:</strong> ${formatDeliveryDay(menu.delivery_date)}</p>`
    : "";

  // Confirmation to the customer.
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: `We got your order — ${menuTitle}`,
      html: emailLayout(
        "Order received 🍽️",
        `<p>Thanks! Here's what you ordered for <strong>${menuTitle}</strong>:</p>${itemsHtml}${deliveryLine}${payLine}${
          order.notes ? `<p><strong>Your notes:</strong> ${order.notes}</p>` : ""
        }<p>You can tweak it any time from the menu before Ryan starts cooking.</p>`
      ),
    });
  }

  // Alert to admins. Profiles are no longer readable across users, so the
  // addresses come from the admin_emails() database function instead.
  const { data: adminEmails } = await supabase.rpc("admin_emails");
  if (adminEmails && adminEmails.length) {
    await sendEmail({
      to: adminEmails,
      subject: `New order from ${customerName} — ${menuTitle}`,
      html: emailLayout(
        "New order 🧑‍🍳",
        `<p><strong>${customerName}</strong> ordered for <strong>${menuTitle}</strong>:</p>${itemsHtml}${payLine}${
          order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ""
        }`
      ),
    });
  }

  return NextResponse.json({ ok: true });
}
