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
  href?: string;
}
