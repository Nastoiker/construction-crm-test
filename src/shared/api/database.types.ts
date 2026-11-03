export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      objects: {
        Row: {
          address: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          name: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          version?: number;
        };
        Update: {
          address?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'objects_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          display_name: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
        };
        ComputedFields: never;
        Insert: {
          display_name: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
        };
        Update: {
          display_name?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
        };
        Relationships: [];
      };
      task_history: {
        Row: {
          actor_id: string;
          comment: string | null;
          created_at: string;
          from_status: Database['public']['Enums']['task_status'] | null;
          id: string;
          task_id: string;
          to_status: Database['public']['Enums']['task_status'];
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          comment?: string | null;
          created_at?: string;
          from_status?: Database['public']['Enums']['task_status'] | null;
          id?: string;
          task_id: string;
          to_status: Database['public']['Enums']['task_status'];
        };
        Update: {
          actor_id?: string;
          comment?: string | null;
          created_at?: string;
          from_status?: Database['public']['Enums']['task_status'] | null;
          id?: string;
          task_id?: string;
          to_status?: Database['public']['Enums']['task_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'task_history_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_history_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string;
          author_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string;
          id: string;
          object_id: string;
          status: Database['public']['Enums']['task_status'];
          title: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          assignee_id: string;
          author_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          object_id: string;
          status?: Database['public']['Enums']['task_status'];
          title: string;
          version?: number;
        };
        Update: {
          assignee_id?: string;
          author_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          object_id?: string;
          status?: Database['public']['Enums']['task_status'];
          title?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_object_id_fkey';
            columns: ['object_id'];
            isOneToOne: false;
            referencedRelation: 'objects';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_object: {
        Args: { p_address: string; p_name: string };
        Returns: string;
      };
      create_task: {
        Args: {
          p_assignee_id: string;
          p_description: string;
          p_object_id: string;
          p_title: string;
        };
        Returns: string;
      };
      delete_object: {
        Args: { p_id: string; p_version: number };
        Returns: undefined;
      };
      delete_task: {
        Args: { p_id: string; p_version: number };
        Returns: undefined;
      };
      transition_task: {
        Args: {
          p_comment?: string;
          p_id: string;
          p_to: Database['public']['Enums']['task_status'];
          p_version: number;
        };
        Returns: undefined;
      };
      update_object: {
        Args: {
          p_address: string;
          p_id: string;
          p_name: string;
          p_version: number;
        };
        Returns: undefined;
      };
      update_task: {
        Args: {
          p_assignee_id: string;
          p_description: string;
          p_id: string;
          p_title: string;
          p_version: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'manager' | 'executor';
      task_status: 'new' | 'in_progress' | 'review' | 'accepted' | 'rework';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['manager', 'executor'],
      task_status: ['new', 'in_progress', 'review', 'accepted', 'rework'],
    },
  },
} as const;
