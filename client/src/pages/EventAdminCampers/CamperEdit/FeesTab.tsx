import React from 'react';

import {
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import {
  formatDateTimeForViewing,
} from 'utils/time';
import ConfirmDialog from 'components/Modal/ConfirmDialog';

import api, { useCustomChargeTypeLookup } from 'hooks/api';

import AddCustomChargeFormModal from './AddCustomChargeFormModal';

interface Props {
  event: ApiEvent;
  camper: ApiCamper;
}


function FeesTab({ camper, event }: Props) {
  const customChargeApi = api.useGetCustomChargesQuery({ camper: camper.id });
  const [deleteCustomChargeApi] = api.useDeleteCustomChargeMutation();
  const customChargeTypeLookup = useCustomChargeTypeLookup();
  const [showAddFees, setShowAddFees] = React.useState<boolean>(false);
  const [customChargeToDelete, setCustomChargeToDelete] = React.useState<ApiCustomCharge>();
  const deleteModal  = React.useRef<ConfirmDialog>(null);

  if (customChargeApi.isLoading || !customChargeApi.data) return <Spinner />;
  if (!customChargeTypeLookup) return <Spinner />;

  const customCharges = customChargeApi.data.filter(
    cc => camper.id.toString() === cc.camper.toString()
  );
  const camperFees = camper.server_pricing_results;

  const showAddFeesModal = () => setShowAddFees(true);
  const deleteCustomCharge = (customCharge: ApiCustomCharge) => () => {
    setCustomChargeToDelete(customCharge);

    deleteModal.current?.show();
  };

  const formatDate = formatDateTimeForViewing();

  return (
    <div>
      <div>
        {
          Object.keys(camperFees).filter(k => k !== 'total').map(
            (k) => (<div key={k}>
              {k}: ${camperFees[k]}
            </div>)
          )
        }
        <div>Total: ${camperFees.total}</div>
      </div>
      <hr />
      <h2>Custom Charges</h2>
      {
        customCharges.length <= 0 ? (
          <p>
            No custom charges at this time
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>date</th>
                <th>type</th>
                <th>amount</th>
                <th>notes</th>
                <th>&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {
                customCharges.map(cc => (
                  <tr key={cc.id}>
                    <td>{formatDate(cc.created_at)}</td>
                    <td>{
                      customChargeTypeLookup[cc.custom_charge_type].label || ''
                    }</td>
                    <td>${cc.amount}</td>
                    <td>{cc.notes}</td>
                    <td>
                      <Button variant="danger" onClick={deleteCustomCharge(cc)}>
                        delete
                      </Button>
                    </td>
                </tr>
              ))
              }
            </tbody>
          </table>
        )
        }
      <p className="button-container">
        <Button onClick={showAddFeesModal}>Add Custom Charge</Button>
      </p>
      {
        <AddCustomChargeFormModal
          event={event}
          camper={camper}
          show={showAddFees}
          onClose={() => setShowAddFees(false)}
          onSave={() => setShowAddFees(false)}
        />
      }
      <ConfirmDialog
        ref={deleteModal}
        title="Delete Custom Charge?"
        message={`${customChargeToDelete && customChargeTypeLookup[customChargeToDelete.custom_charge_type].label}: $${customChargeToDelete?.amount}`}
        onConfirm={() => {
          customChargeToDelete && deleteCustomChargeApi(customChargeToDelete);
          setCustomChargeToDelete(undefined)
        }}
      />
    </div>
  );
}

export default FeesTab;

