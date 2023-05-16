import { visit, Kind } from "graphql";
import type {
  DocumentNode,
  ObjectValueNode,
  OperationDefinitionNode,
} from "graphql";
import type { FieldMappings } from "./types";
import { WRAPPED_VARIABLE_NAME } from "./util";

/**
 * this function uses to convert normal field selection to local field selection with @client directive. for example:
 * ```js
 * model()
 *  .query('firstQuery', () => {})
 *  .query('secondQuery', gql`query { firstQuery otherQuery }`)
 * ```
 * the selection `firstQuery` in `secondQuery` will be transformed to `firstQuery @client` because the firstQuery is registered as dynamic/local query
 * so we don't need to add @client directive any more for registered queries/mutations
 * `otherQuery` is assumed as server query
 * @param document
 * @param fieldMappings
 * @returns
 */
const patchLocalFields = (
  document: DocumentNode,
  fieldMappings: FieldMappings
) => {
  // stack of parent types, the first one is latest type
  const parentTypes: (string | undefined)[] = [];
  return visit(document, {
    [Kind.FIELD]: {
      enter(field, _1, _2, _3, ancestors) {
        let dataType: string | undefined;
        try {
          const parentField = ancestors[ancestors.length - 2];
          const isRoot =
            parentField &&
            (parentField as OperationDefinitionNode).kind ===
              Kind.OPERATION_DEFINITION;
          const availFields =
            (isRoot
              ? fieldMappings.ROOT
              : parentTypes[0]
              ? fieldMappings[parentTypes[0]]
              : undefined) ?? {};

          if (field.name.value in availFields) {
            const mapping = availFields[field.name.value];
            dataType = mapping.type;
            const newField = {
              ...field,
              directives: [
                ...(field.directives ?? []),
                // add @client directive
                {
                  kind: Kind.DIRECTIVE,
                  name: {
                    kind: Kind.NAME,
                    value: "client",
                  },
                },
              ],
            };

            if (!newField.alias && field.name.value !== mapping.field) {
              newField.alias = { kind: Kind.NAME, value: field.name.value };
            }
            // for dynamic query/mutation we must wrap all arguments to __VARS__ arg
            if (newField.arguments?.length) {
              const objValues: ObjectValueNode = {
                kind: Kind.OBJECT,
                fields: newField.arguments.map((arg) => ({
                  kind: Kind.OBJECT_FIELD,
                  name: arg.name,
                  value: arg.value,
                })),
              };

              newField.arguments = [
                {
                  kind: Kind.ARGUMENT,
                  name: { kind: Kind.NAME, value: WRAPPED_VARIABLE_NAME },
                  value: objValues,
                },
              ];
            }

            newField.name = {
              kind: Kind.NAME,
              value: mapping.field,
            };

            return newField;
          }
        } finally {
          parentTypes.unshift(dataType);
        }
      },
      leave() {
        parentTypes.shift();
      },
    },
  });
};

export { patchLocalFields };
