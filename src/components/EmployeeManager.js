import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Checkbox, Button, Table, Space, Modal } from 'antd';
import { loadEmployeesByDepartment, saveEmployeesByDepartment } from '../utils/localStorageHelper';

const { Option } = Select;

const EmployeeManager = ({
  employees,
  onAddEmployee,
  onDeleteEmployee,
  currentDepartment,
  departments,
}) => {
  const [form] = Form.useForm();
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departmentEmployees, setDepartmentEmployees] = useState([]);

  // Convert department ID to department name if currentDepartment is an ID
  const getDepartmentNameById = deptId => {
    if (!departments || !Array.isArray(departments)) return null;
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : null;
  };

  // Get the actual department name based on the currentDepartment ID
  const currentDepartmentName = currentDepartment ? getDepartmentNameById(currentDepartment) : null;

  // Загрузка сотрудников для текущего отдела при монтировании компонента
  useEffect(() => {
    if (currentDepartmentName) {
      const loadedEmployees = loadEmployeesByDepartment(currentDepartmentName);
      setDepartmentEmployees(loadedEmployees);
    }
  }, [currentDepartmentName]);

  // Сохранение сотрудников для текущего отдела при их изменении
  useEffect(() => {
    if (currentDepartmentName) {
      saveEmployeesByDepartment(currentDepartmentName, departmentEmployees);
    }
  }, [departmentEmployees, currentDepartmentName]);

  // Синхронизация с родительским компонентом
  useEffect(() => {
    if (currentDepartmentName) {
      const departmentEmps = employees.filter(emp => emp.department === currentDepartmentName);
      setDepartmentEmployees(departmentEmps);
    } else {
      // If no specific department is selected, show all employees
      setDepartmentEmployees(employees);
    }
  }, [employees, currentDepartmentName]);

  const onFinish = values => {
    const newEmployee = {
      id: Date.now(), // временный ID, будет заменен на нормальный при сохранении
      ...values,
    };
    onAddEmployee(newEmployee);
    // Добавляем сотрудника в локальное состояние для текущего отдела
    if (currentDepartmentName && newEmployee.department === currentDepartmentName) {
      setDepartmentEmployees(prev => [...prev, newEmployee]);
    }
    form.resetFields();
  };

  const handleDelete = employeeId => {
    Modal.confirm({
      title: 'Czy na pewno chcesz usunąć tego pracownika?',
      content: 'Tej operacji nie można cofnąć.',
      okText: 'Usuń',
      cancelText: 'Anuluj',
      onOk: () => {
        onDeleteEmployee(employeeId);
        // Удаляем сотрудника из локального состояния для текущего отдела
        if (currentDepartmentName) {
          setDepartmentEmployees(prev => prev.filter(emp => emp.id !== employeeId));
        }
      },
    });
  };

  const filteredEmployees =
    selectedDepartment === 'all'
      ? departmentEmployees
      : departmentEmployees.filter(emp => emp.department === selectedDepartment);

  const columns = [
    {
      title: 'Imię',
      dataIndex: 'firstName',
      key: 'firstName',
    },
    {
      title: 'Nazwisko',
      dataIndex: 'lastName',
      key: 'lastName',
    },
    {
      title: 'Dział',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Nie pracuje w soboty',
      dataIndex: 'doesNotWorkOnSaturdays',
      key: 'doesNotWorkOnSaturdays',
      render: text => (text ? 'Tak' : 'Nie'),
    },
    {
      title: 'Akcje',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button danger onClick={() => handleDelete(record.id)} size="small">
            Usuń
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="employee-manager">
      <Card title="Zarządzanie pracownikami" style={{ marginBottom: '20px' }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="firstName"
            label="Imię"
            rules={[{ required: true, message: 'Proszę wpisać imię pracownika!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="lastName"
            label="Nazwisko"
            rules={[{ required: true, message: 'Proszę wpisać nazwisko pracownika!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="department"
            label="Dział"
            rules={[{ required: true, message: 'Proszę wybrać dział!' }]}
          >
            <Select placeholder="Wybierz dział">
              {(departments && departments.length > 0
                ? departments
                : ['Stacja', 'Wild Bean Cafe']
              ).map(dept => (
                <Option
                  key={typeof dept === 'object' ? dept.id : dept}
                  value={typeof dept === 'object' ? dept.name : dept}
                >
                  {typeof dept === 'object' ? dept.name : dept}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="doesNotWorkOnSaturdays" valuePropName="checked">
            <Checkbox>Nie pracuje w soboty</Checkbox>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              Dodaj pracownika
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Lista pracowników">
        <div style={{ marginBottom: '16px' }}>
          <Select defaultValue="all" style={{ width: 200 }} onChange={setSelectedDepartment}>
            <Option value="all">Wszyscy</Option>
            {(departments && departments.length > 0
              ? departments
              : ['Stacja', 'Wild Bean Cafe']
            ).map(dept => (
              <Option
                key={typeof dept === 'object' ? dept.id : dept}
                value={typeof dept === 'object' ? dept.name : dept}
              >
                {typeof dept === 'object' ? dept.name : dept}
              </Option>
            ))}
          </Select>
        </div>

        <Table
          dataSource={filteredEmployees}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default EmployeeManager;
