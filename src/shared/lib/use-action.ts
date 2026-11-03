import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useAction<T>(
  action: (values: T) => Promise<void>,
  onSuccess?: () => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess,
    onSettled: () => client.invalidateQueries(),
  });
}
