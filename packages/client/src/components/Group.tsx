import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";

export type Props = {
  name: string;
  value: any;
  readOnly?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
};

const Group = (props: Props) => {
  return (
    <Form.Group as={Row} className="mb-3">
      <Form.Label column sm={2}>
        {props.name}
      </Form.Label>
      <Col sm={10}>
        <Form.Control
          type="text"
          readOnly={props.readOnly}
          value={props.value}
          disabled={props.disabled}
          onChange={(e) => props.onChange?.(e.target.value)}
        />
      </Col>
    </Form.Group>
  );
};

export { Group };
