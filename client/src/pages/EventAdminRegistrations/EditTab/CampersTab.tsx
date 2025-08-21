import React from 'react';

import {
  Card,
  ButtonGroup,
  Button
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import api, { useCamperLookup } from 'hooks/api';
import {
  useLocation,
  matchPath,
  generatePath,
} from 'react-router-dom';

interface Props {
  registration: AugmentedRegistration;
}

const arrayMove = (arr: any[], oldi: number, newi: number) => {
  if (newi >= arr.length) {
    var k = newi - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }

  arr.splice(newi, 0, arr.splice(oldi, 1)[0]);
  
  return arr;
};

type UrlParams = {
  eventId: string | number,
  organizationId: string | number,
};

function PaymentTab(props: Props) {
  const [patchCamper] = api.useUpdateCamperMutation();
  const camperLookup = useCamperLookup();
  const [isLoading, setIsLoading] = React.useState(false);
  const loc = useLocation();

  if ( isLoading || !camperLookup) return <Spinner />;

  const campers = Object.values(camperLookup)
    .filter(c => c.registration === props.registration.id)
    .sort((ca, cb) => ca.sequence - cb.sequence);

  const saveCamperOrder = async (campers: ApiCamper[]) => {
    setIsLoading(true);
    try {
      await Promise.all(
        campers.map((c, i) => patchCamper({
          id: c.id,
          sequence: i,
        }))
      );
    } catch (e) {
      // nothing
    }
    setIsLoading(false);
  }

  const onClickOrder = (newi: number, oldi: number) =>
    saveCamperOrder(arrayMove(campers, newi, oldi));

  const createCamperUrl = (c: ApiCamper) => {
    const locInfo = matchPath(
      loc.pathname,
      '/admin/organization/:organizationId/event/:eventId',
    );

    if (!locInfo) return '#';

    const params = locInfo.params as UrlParams;

    return generatePath(
      '/admin/organization/:organizationId/event/:eventId/campers?camperId=:id',
      {
        ...params,
        id: c.id,
      },
    );
  }

  return (
    <div className="registration-edit-campers-tab">
      {
        campers.map(
          (c, i) => (
            <Card key={c.id}>
              <Card.Body>
                <Card.Link href={createCamperUrl(c)}>
                  {c.attributes.first_name} {c.attributes.last_name}
                </Card.Link>
                <ButtonGroup>
                  <Button onClick={() => onClickOrder(i-1, i)}>Move ⬆</Button>
                  <Button onClick={() => onClickOrder(i+1, i)}>Move ⬇</Button>
                </ButtonGroup>
              </Card.Body>
            </Card>
          )
        )
      }
    </div>
  );
}

export default PaymentTab;

