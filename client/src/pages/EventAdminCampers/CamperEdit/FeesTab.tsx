import React from 'react';

import {
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import {
  formatDateTimeForViewing,
} from 'utils/time';
import ConfirmDialog from 'components/Modal/ConfirmDialog';

import api from 'hooks/api';

import AddCustomChargeFormModal from './AddCustomChargeFormModal';

interface Props {
  event: ApiEvent;
  camper: ApiCamper;
}


function FeesTab({ camper, event }: Props) {
  const registrationApi = api.useGetRegistrationByIdQuery(camper.registration);
  const customChargeApi = api.useGetCustomChargesQuery(camper);
  const [deleteCustomChargeApi] = api.useDeleteCustomChargeMutation();
  const customChargeTypeApi = api.useGetCustomChargeTypesQuery();
  const [showAddFees, setShowAddFees] = React.useState<boolean>(false);
  const [customChargeToDelete, setCustomChargeToDelete] = React.useState<ApiCustomCharge>();
  const [customChargeToDeleteType, setCustomChargeToDeleteType] = React.useState<ApiCustomChargeType | undefined>();
  const deleteModal  = React.useRef<ConfirmDialog>(null);

  if (registrationApi.isLoading || !registrationApi.data) return <Spinner />;
  if (customChargeApi.isLoading || !customChargeApi.data) return <Spinner />;
  if (customChargeTypeApi.isLoading || !customChargeTypeApi.data) return <Spinner />;

  const customCharges = customChargeApi.data;
  const customChargeTypes = customChargeTypeApi.data;
  const camperFees = camper.server_pricing_results;

  const showAddFeesModal = () => setShowAddFees(true);
  const deleteCustomCharge = (customCharge: ApiCustomCharge) => () => {
    setCustomChargeToDelete(customCharge);
    setCustomChargeToDeleteType(customChargeTypes.find(cct => cct.id === customCharge.custom_charge_type));
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
                      customChargeTypes
                      .find(cct => cct.id === cc.custom_charge_type)
                      ?.label || ''}</td>
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
        message={`${customChargeToDeleteType?.label}: $${customChargeToDelete?.amount}`}
        onConfirm={() => {
          customChargeToDelete && deleteCustomChargeApi(customChargeToDelete);
          setCustomChargeToDelete(undefined)
        }}
      />
    </div>
  );
}

export default FeesTab;

