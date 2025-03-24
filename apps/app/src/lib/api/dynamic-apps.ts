import { API_BASE_URL } from "~/constants";

export interface AppSchema {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  formSchema: {
    steps: Array<{
      id: string;
      title: string;
      description?: string;
      fields: Array<{
        id: string;
        type: string;
        label: string;
        description?: string;
        placeholder?: string;
        required: boolean;
        defaultValue?: any;
        validation?: {
          pattern?: string;
          min?: number;
          max?: number;
          minLength?: number;
          maxLength?: number;
          options?: Array<{ label: string; value: string }>;
        };
      }>;
    }>;
  };
  responseSchema: {
    type: string;
    display: {
      fields?: Array<{
        key: string;
        label: string;
        format?: string;
      }>;
      template?: string;
    };
  };
}

export interface AppListItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
}

export const fetchDynamicApps = async (): Promise<AppListItem[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic-apps`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dynamic apps: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching dynamic apps:", error);
    throw error;
  }
};

export const fetchDynamicAppById = async (id: string): Promise<AppSchema> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic-apps/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dynamic app: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching dynamic app ${id}:`, error);
    throw error;
  }
};

export const executeDynamicApp = async (
  id: string,
  formData: Record<string, any>,
): Promise<Record<string, any>> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic-apps/${id}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute dynamic app: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error executing dynamic app ${id}:`, error);
    throw error;
  }
};
