import { Form, redirect, json, useLoaderData, useActionData } from '@remix-run/react';
import axios from 'axios';
import React, { useState } from 'react';
import styles from '../styles/style.module.css';
import FormData from 'form-data';
import prisma from '../db.server'; // Ensure Prisma is setup
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);
    return { session };
  } catch (error) {
    console.error("Authentication error:", error);
    return json({ shop: null, message: "Please log in." });
  }
}

// Action function: Handle login submission
export async function action({ request }) {
  const formData = new FormData();
  const data = await request.formData();
  const email = data.get('email');
  const password = data.get('password');
  const { admin, session } = await authenticate.admin(request);

  // Validate email and password
  if (!email || !password) {
    return json({ error: "Email and password are required" }, { status: 400 });
  }

  const apiUrl = process.env.API_URL;
  try {
    // Prepare the form data
    formData.append('username', email);
    formData.append('password', password);

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${apiUrl}/auth/token/`,
      data: formData,
    };

    const response = await axios.request(config);

    // Handle specific response codes
    if (response?.status === 200 && response?.data?.access_token) {
      const token = response.data.access_token;
      const shop = session?.shop || "default_shop";

      // Use upsert to either update or create the record based on the shop
      await prisma.apiToken.upsert({
        where: { shop },
        update: {
          token,
          passwordapi: email,  // Assuming passwordapi should store email
          usernameapi: password, // Assuming usernameapi should store password
        },
        create: { 
          shop, 
          token, 
          passwordapi: email, // Create new record with provided email and password
          usernameapi: password,
        },
      });
    
      return redirect('/app');
    } else {
      return json({ error: "Invalid login credentials. Please check your email and password." }, { status: 401 });
    }
  } catch (err) {
    console.error('Login error:', err);
    // Handle errors during the request
    return json({ error: "An error occurred while processing your request." }, { status: 500 });
  }
}

// Login Form Component
export default function Login() {
  const { session } = useLoaderData();
  const actionData = useActionData();  // To capture the error returned by the action

  return (
    <div className={styles.container}>
      {session ? (
        <Form method="POST">
          <label>Email:
            <input type="email" name="email" required />
          </label>
          <label>Password:
            <input type="password" name="password" required />
          </label>
          <button type="submit">Login</button>
        </Form>
      ) : (
        <p>Please log in to continue</p>
      )}

      {/* Show error message if it exists */}
      {actionData?.error && <p style={{ color: 'red' }}>{actionData.error}</p>}
    </div>
  );
}
